// FILE: client/src/audio/core/audio-graph.ts
import { getAudioContext, resumeAudioContext, onAudioContext, closeAudioContext, } from './audio-context';
// ─── AudioGraph ───────────────────────────────────────────────────────────────
export class AudioGraph {
    // ─── Constructor ────────────────────────────────────────────────────────────
    constructor() {
        this.sends = new Map();
        this._masterVolume = 1.0;
        this._disposed = false;
        this.listeners = {};
        this.context = getAudioContext();
        this.destination = this.context.destination;
        // Master gain
        this.masterGain = this.context.createGain();
        this.masterGain.gain.setTargetAtTime(1.0, this.context.currentTime, 0.015);
        // Transparent brickwall limiter — prevents inter-sample clipping on export
        this.limiter = this.context.createDynamicsCompressor();
        this.limiter.threshold.value = -1; // dBFS
        this.limiter.knee.value = 0;
        this.limiter.ratio.value = 20;
        this.limiter.attack.value = 0.001;
        this.limiter.release.value = 0.1;
        // Analyser for metering
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.analyserBuffer = new Float32Array(this.analyser.fftSize);
        // Chain: masterGain → limiter → analyser → destination
        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.analyser);
        this.analyser.connect(this.destination);
        // Re-create internal nodes if the context is closed/re-opened
        this.removeContextListener = onAudioContext(() => {
            // If the singleton was closed and re-created, our graph nodes are stale.
            // Consumers should create a new AudioGraph instance in this case.
            console.warn('[AudioGraph] AudioContext was re-created. Instantiate a new AudioGraph.');
        });
        this.startMetering();
    }
    // ─── Volume ──────────────────────────────────────────────────────────────────
    get masterVolume() { return this._masterVolume; }
    /**
     * Set master output volume (0–1) with a short ramp to avoid clicks.
     */
    setMasterVolume(value, rampSeconds = 0.015) {
        this.assertNotDisposed();
        const clamped = clamp(value, 0, 1);
        this._masterVolume = clamped;
        this.masterGain.gain.setTargetAtTime(clamped, this.context.currentTime, rampSeconds);
        this.emit('masterVolumeChanged', { value: clamped });
    }
    /**
     * Mute/unmute the master output without changing the stored volume.
     */
    setMasterMute(muted, rampSeconds = 0.015) {
        this.assertNotDisposed();
        const target = muted ? 0 : this._masterVolume;
        this.masterGain.gain.setTargetAtTime(target, this.context.currentTime, rampSeconds);
    }
    // ─── Node Routing ────────────────────────────────────────────────────────────
    /**
     * Connect an arbitrary node into the master gain bus.
     */
    connect(node) {
        this.assertNotDisposed();
        node.connect(this.masterGain);
    }
    /**
     * Disconnect a node from the master gain bus.
     * Silently ignores InvalidAccessError (node wasn't connected).
     */
    disconnect(node) {
        try {
            node.disconnect(this.masterGain);
        }
        catch { /* already disconnected */ }
    }
    // ─── Send / Return Buses ─────────────────────────────────────────────────────
    /**
     * Create a named send/return bus (e.g. "reverb", "delay").
     * Callers connect their track send into `bus.input` and the bus output
     * feeds back into the master chain.
     */
    addSend(id, initialGain = 1.0) {
        this.assertNotDisposed();
        if (this.sends.has(id))
            return this.sends.get(id);
        const input = this.context.createGain();
        const gain = this.context.createGain();
        const output = this.context.createGain();
        gain.gain.setTargetAtTime(initialGain, this.context.currentTime, 0.015);
        output.gain.setTargetAtTime(1.0, this.context.currentTime, 0.015);
        input.connect(gain);
        gain.connect(output);
        output.connect(this.masterGain);
        const bus = { id, gain, input, output };
        this.sends.set(id, bus);
        this.emit('sendAdded', { bus });
        return bus;
    }
    getSend(id) {
        return this.sends.get(id);
    }
    removeSend(id) {
        const bus = this.sends.get(id);
        if (!bus)
            return;
        try {
            bus.input.disconnect();
        }
        catch { /* ok */ }
        try {
            bus.gain.disconnect();
        }
        catch { /* ok */ }
        try {
            bus.output.disconnect();
        }
        catch { /* ok */ }
        this.sends.delete(id);
        this.emit('sendRemoved', { id });
    }
    /** All current send bus ids */
    get sendIds() {
        return [...this.sends.keys()];
    }
    // ─── Metering ────────────────────────────────────────────────────────────────
    /**
     * Latest meter reading derived from the analyser node.
     * Populated every animation frame while the graph is alive.
     */
    getMeterReading() {
        return this.computeMeter();
    }
    startMetering() {
        const tick = () => {
            if (this._disposed)
                return;
            const reading = this.computeMeter();
            this.emit('metering', { reading });
            this.meteringFrameId = requestAnimationFrame(tick);
        };
        this.meteringFrameId = requestAnimationFrame(tick);
    }
    computeMeter() {
        this.analyser.getFloatTimeDomainData(this.analyserBuffer);
        let peak = 0;
        let sumSq = 0;
        for (let i = 0; i < this.analyserBuffer.length; i++) {
            const abs = Math.abs(this.analyserBuffer[i]);
            if (abs > peak)
                peak = abs;
            sumSq += abs * abs;
        }
        const rms = Math.sqrt(sumSq / this.analyserBuffer.length);
        return { peak, rms, clipping: peak >= 1.0 };
    }
    // ─── Context helpers ──────────────────────────────────────────────────────────
    async resume() {
        this.assertNotDisposed();
        await resumeAudioContext();
    }
    async suspend() {
        if (this._disposed)
            return;
        await this.context.suspend();
    }
    /** Current AudioContext time in seconds */
    get currentTime() {
        return this.context.currentTime;
    }
    /** Base latency in seconds (input → output round-trip estimate) */
    get baseLatency() {
        return this.context.baseLatency ?? 0;
    }
    // ─── Lifecycle ────────────────────────────────────────────────────────────────
    dispose() {
        if (this._disposed)
            return;
        this._disposed = true;
        if (this.meteringFrameId !== undefined) {
            cancelAnimationFrame(this.meteringFrameId);
        }
        this.removeContextListener();
        for (const id of this.sends.keys())
            this.removeSend(id);
        try {
            this.masterGain.disconnect();
        }
        catch { /* ok */ }
        try {
            this.limiter.disconnect();
        }
        catch { /* ok */ }
        try {
            this.analyser.disconnect();
        }
        catch { /* ok */ }
        this.emit('disposed', {});
    }
    /**
     * Dispose the graph AND close the underlying AudioContext singleton.
     * After this, calling `getAudioContext()` will create a fresh one.
     */
    async close() {
        this.dispose();
        await closeAudioContext();
    }
    // ─── Introspection / debug ────────────────────────────────────────────────────
    toJSON() {
        return {
            contextState: this.context.state,
            masterVolume: this._masterVolume,
            sampleRate: this.context.sampleRate,
            baseLatency: this.baseLatency,
            currentTime: this.currentTime,
            sends: this.sendIds,
            disposed: this._disposed,
        };
    }
    // ─── Event emitter ────────────────────────────────────────────────────────────
    on(event, listener) {
        if (!this.listeners[event]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.listeners[event] = new Set();
        }
        this.listeners[event].add(listener);
        return this;
    }
    off(event, listener) {
        this.listeners[event]?.delete(listener);
        return this;
    }
    once(event, listener) {
        const wrapper = (payload) => {
            listener(payload);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }
    emit(event, payload) {
        this.listeners[event]?.forEach((fn) => fn(payload));
    }
    // ─── Private helpers ─────────────────────────────────────────────────────────
    assertNotDisposed() {
        if (this._disposed)
            throw new Error('[AudioGraph] Instance has been disposed.');
    }
}
// ─── Singleton export ─────────────────────────────────────────────────────────
// Lazily created so tests can import without triggering AudioContext construction
let audioGraph = null;
export function getAudioGraph() {
    if (!audioGraph || audioGraph._disposed) {
        audioGraph = new AudioGraph();
    }
    return audioGraph;
}
/** Convenience re-export for code that imported the old `audioGraph` constant */
export { getAudioGraph as audioGraph };
// ─── Utilities ────────────────────────────────────────────────────────────────
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
