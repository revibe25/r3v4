// client/src/audio/mixer/mixer-channel.ts
import { getAudioContext } from "../core/audio-context";
import { smoothParam } from "../../utils/audio-utils";
import { FXChain } from "../fx/fx-chain";
import { VSTFXNode } from "../fx/vst-fx-node";
/**
 * Represents a single mixer channel with audio routing, effects chain, and controls
 */
export class MixerChannel {
    constructor(id) {
        // State
        this._muted = false;
        this._solo = false;
        this._armed = false;
        this._volume = 0.8;
        this._pan = 0;
        // Meter values
        this._currentLevel = 0;
        this._peakLevel = 0;
        this.peakHoldTime = 0;
        this.PEAK_HOLD_DURATION = 2000; // ms
        this._name = '';
        this.id = id;
        this.context = getAudioContext();
        // Create audio nodes
        this.input = this.context.createGain();
        this.fxChain = new FXChain();
        this.panNode = this.context.createStereoPanner();
        this.gainNode = this.context.createGain();
        this.analyserNode = this.context.createAnalyser();
        this.output = this.context.createGain();
        // Configure analyser
        this.analyserNode.fftSize = 2048;
        this.analyserNode.smoothingTimeConstant = 0.8;
        this.meterDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        // Set default values
        this.gainNode.gain.setTargetAtTime(this._volume, this.context.currentTime, 0.015);
        this.panNode.pan.value = this._pan;
        this.output.gain.setTargetAtTime(1, this.context.currentTime, 0.015);
        // Wire signal path: input → fxChain → pan → gain → analyser → output
        this.input.connect(this.fxChain.getInput());
        this.fxChain.getOutput().connect(this.panNode);
        this.panNode.connect(this.gainNode);
        this.gainNode.connect(this.analyserNode);
        this.analyserNode.connect(this.output);
    }
    /* ===========================
       Routing
    ============================ */
    /**
     * Connect this channel to a destination node
     */
    connect(destination) {
        this.output.connect(destination);
    }
    /**
     * Disconnect this channel from all destinations
     */
    disconnect() {
        this.output.disconnect();
    }
    /* ===========================
       Mixer Controls
    ============================ */
    /**
     * Set channel volume (0.0 to 1.0)
     */
    setVolume(gain) {
        this._volume = Math.max(0, Math.min(1, gain));
        smoothParam(this.gainNode.gain, this._muted ? 0 : this._volume, this.context.currentTime);
    }
    /**
     * Get current volume level
     */
    getVolume() {
        return this._volume;
    }
    /**
     * Set pan position (-1.0 left to 1.0 right)
     */
    setPan(value) {
        this._pan = Math.max(-1, Math.min(1, value));
        smoothParam(this.panNode.pan, this._pan, this.context.currentTime);
    }
    /**
     * Get current pan position
     */
    getPan() {
        return this._pan;
    }
    /**
     * Mute/unmute this channel
     */
    setMute(muted) {
        this._muted = muted;
        smoothParam(this.gainNode.gain, muted ? 0 : this._volume, this.context.currentTime);
    }
    /**
     * Get mute state
     */
    isMuted() {
        return this._muted;
    }
    /**
     * Toggle mute state
     */
    toggleMute() {
        this.setMute(!this._muted);
    }
    /**
     * Set solo state
     */
    setSolo(solo) {
        this._solo = solo;
    }
    /**
     * Get solo state
     */
    isSolo() {
        return this._solo;
    }
    /**
     * Toggle solo state
     */
    toggleSolo() {
        this._solo = !this._solo;
    }
    /**
     * Set armed state for recording
     */
    setArmed(armed) {
        this._armed = armed;
    }
    /**
     * Get armed state
     */
    isArmed() {
        return this._armed;
    }
    /**
     * Toggle armed state
     */
    toggleArmed() {
        this._armed = !this._armed;
    }
    /* ===========================
       FX Chain Management
    ============================ */
    /**
     * Add an effect to the FX chain
     */
    addFX(fx, index) {
        this.fxChain.addFX(fx, index);
    }
    /**
     * Remove an effect from the FX chain by ID
     */
    removeFX(fxId) {
        this.fxChain.removeEffect(fxId);
    }
    /**
     * Move an effect within the FX chain
     */
    moveFX(fromIndex, toIndex) {
        const effects = this.fxChain.getAllEffects();
        const fx = effects[fromIndex];
        if (fx)
            this.fxChain.reorderEffect(fx.id, toIndex);
    }
    /**
     * Load and add a VST plugin to this channel's FX chain
     * @param vstUrl - URL to the WASM VST file
     * @param workletName - Optional worklet processor name
     * @param config - Optional VST configuration
     * @returns Promise that resolves to the loaded VST node
     */
    async addVST(vstUrl, workletName, config) {
        try {
            const vstNode = await this.fxChain.addEffect(vstUrl, workletName, config);
            // Type assertion since we know addVSTEffect returns VSTFXNode
            if (!(vstNode instanceof VSTFXNode)) {
                throw new Error('Expected VSTFXNode but got different type');
            }
            return vstNode;
        }
        catch (error) {
            console.error(`Failed to add VST to channel ${this.id}:`, error);
            throw error;
        }
    }
    /**
     * Get all effects in this channel's FX chain
     */
    getEffects() {
        return this.fxChain.getAllEffects();
    }
    /**
     * Get a specific effect by ID
     */
    getEffect(fxId) {
        return this.fxChain.getAllEffects().find(fx => fx.id === fxId);
    }
    /**
     * Get all VST plugins on this channel
     */
    getVSTPlugins() {
        return this.fxChain.getAllEffects().filter(fx => fx instanceof VSTFXNode);
    }
    /**
     * Clear all effects from the FX chain
     */
    clearFX() {
        const effects = [...this.fxChain.getAllEffects()];
        effects.forEach(fx => this.removeFX(fx.id));
    }
    /* ===========================
       Metering
    ============================ */
    /**
     * Update and get current meter level (0.0 to 1.0)
     */
    getMeterLevel() {
        this.analyserNode.getByteTimeDomainData(this.meterDataArray);
        let sum = 0;
        for (let i = 0; i < this.meterDataArray.length; i++) {
            const normalized = (this.meterDataArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / this.meterDataArray.length);
        this._currentLevel = Math.min(1, rms * 2); // Scale up for visibility
        // Update peak with hold
        const now = Date.now();
        if (this._currentLevel > this._peakLevel) {
            this._peakLevel = this._currentLevel;
            this.peakHoldTime = now;
        }
        else if (now - this.peakHoldTime > this.PEAK_HOLD_DURATION) {
            // Gradually decay peak
            this._peakLevel = Math.max(this._currentLevel, this._peakLevel * 0.95);
        }
        return this._currentLevel;
    }
    /**
     * Get peak level
     */
    getPeakLevel() {
        return this._peakLevel;
    }
    /**
     * Reset peak level
     */
    resetPeak() {
        this._peakLevel = 0;
        this.peakHoldTime = Date.now();
    }
    /**
     * Get frequency spectrum data
     */
    getFrequencyData() {
        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteFrequencyData(dataArray);
        return dataArray;
    }
    /* ===========================
       State Management
    ============================ */
    /**
     * Get current channel state
     */
    getState() {
        return {
            id: this.id,
            volume: this._volume,
            pan: this._pan,
            muted: this._muted,
            solo: this._solo,
            armed: this._armed,
            level: this._currentLevel,
            peak: this._peakLevel,
            effects: this.fxChain.getAllEffects().map(fx => ({
                id: fx.id,
                bypassed: fx.bypassed,
            })),
        };
    }
    /**
     * Serialize channel state for saving
     */
    serialize() {
        return {
            id: this.id,
            volume: this._volume,
            pan: this._pan,
            muted: this._muted,
            solo: this._solo,
            armed: this._armed,
            fxChain: {} /* FXChain.serialize() not implemented */,
        };
    }
    /**
     * Restore channel from serialized state
     */
    async deserialize(data) {
        this.setVolume(data.volume ?? 0.8);
        this.setPan(data.pan ?? 0);
        this.setMute(data.muted ?? false);
        this.setSolo(data.solo ?? false);
        this.setArmed(data.armed ?? false);
        if (data.fxChain) {
            // Clear existing FX
            this.clearFX();
            // Restore FX chain
            const restoredChain = new FXChain() /* FXChain.deserialize() not implemented */;
            // Copy effects from restored chain to this channel's chain
            restoredChain.effects.forEach((fx) => {
                this.addFX(fx);
            });
        }
    }
    /* ===========================
       Utility Methods
    ============================ */
    /**
     * Clone this channel (creates a new channel with same settings)
     */
    clone(newId) {
        const clonedChannel = new MixerChannel(newId);
        clonedChannel.setVolume(this._volume);
        clonedChannel.setPan(this._pan);
        clonedChannel.setMute(this._muted);
        clonedChannel.setSolo(this._solo);
        clonedChannel.setArmed(this._armed);
        return clonedChannel;
    }
    /**
     * Reset channel to default state
     */
    reset() {
        this.setVolume(0.8);
        this.setPan(0);
        this.setMute(false);
        this.setSolo(false);
        this.setArmed(false);
        this.clearFX();
        this.resetPeak();
    }
    /**
     * Check if channel is processing audio
     */
    isActive() {
        return this._currentLevel > 0.001 && !this._muted;
    }
    /* ===========================
       Cleanup
    ============================ */
    /**
     * Clean up all resources
     */
    dispose() {
        // Disconnect all nodes
        this.input.disconnect();
        this.panNode.disconnect();
        this.gainNode.disconnect();
        this.analyserNode.disconnect();
        this.output.disconnect();
        // Dispose FX chain
        this.fxChain.dispose();
        // Reset state
        this._muted = false;
        this._solo = false;
        this._armed = false;
        this._currentLevel = 0;
        this._peakLevel = 0;
    }
    // ── Public read-only state getters ────────────────────────────────────────
    // Used by audio-store.ts snapshot loop and saveProject() serialization.
    // Mirrors the private backing fields without exposing setters directly
    // (mutations go through setVolume / setPan / setMute / setSolo).
    get volume() { return this._volume; }
    get pan() { return this._pan; }
    get mute() { return this._muted; }
    get solo() { return this._solo; }
    setDryWet(_dry, _wet) { }
    get name() { return this._name || this.id; }
    setName(name) { this._name = name; }
}
