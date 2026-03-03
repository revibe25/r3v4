// client/src/audio/mixer/mixer-channel.ts

import { getAudioContext } from "../core/audio-context";
import { smoothParam } from "../../utils/audio-utils";
import { FXChain } from "../fx/fx-chain";
import { FXNodeBase } from "../fx/fx-nodebase";
import { VSTFXNode } from "../fx/vst-fx-node";

import type {
  MixerChannel as I,
  MixerChannelConfig,
  EffectChain,
  AudioEffect
} from '@/types/audio';

/**
 * Represents a single mixer channel with audio routing, effects chain, and controls
 */

export class MixerChannel implements MixerChannel {
  readonly id: string;
  readonly context: AudioContext;
  
  // Signal path nodes
  readonly input: GainNode;
  readonly fxChain: FXChain;
  readonly panNode: StereoPannerNode;
  readonly gainNode: GainNode;
  readonly output: GainNode;
  
  // Metering
  readonly analyserNode: AnalyserNode;
  private meterDataArray: Uint8Array;
  
  // State
  private _muted: boolean = false;
  private _solo: boolean = false;
  private _armed: boolean = false;
  private _volume: number = 0.8;
  private _pan: number = 0;
  
  // Meter values
  private _currentLevel: number = 0;
  private _peakLevel: number = 0;
  private peakHoldTime: number = 0;
  private readonly PEAK_HOLD_DURATION = 2000; // ms
  
  constructor(id: string) {
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
    this.meterDataArray = new Uint8Array(this.analyserNode.frequencyBinCount) as unknown as Uint8Array;
    
    // Set default values
    this.gainNode.gain.value = this._volume;
    this.panNode.pan.value = this._pan;
    this.output.gain.value = 1;
    
    // Wire signal path: input → fxChain → pan → gain → analyser → output
    this.input.connect((this.fxChain as any).getInput());
    (this.fxChain as any).getOutput().connect(this.panNode);
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
  connect(destination: AudioNode): void {
    this.output.connect(destination);
  }
  
  /**
   * Disconnect this channel from all destinations
   */
  disconnect(): void {
    this.output.disconnect();
  }

  /* ===========================
     Mixer Controls
  ============================ */
  
  /**
   * Set channel volume (0.0 to 1.0)
   */
  setVolume(gain: number): void {
    this._volume = Math.max(0, Math.min(1, gain));
    smoothParam(
      this.gainNode.gain,
      this._muted ? 0 : this._volume,
      this.context.currentTime
    );
  }
  
  /**
   * Get current volume level
   */
  getVolume(): number {
    return this._volume;
  }
  
  /**
   * Set pan position (-1.0 left to 1.0 right)
   */
  setPan(value: number): void {
    this._pan = Math.max(-1, Math.min(1, value));
    smoothParam(
      this.panNode.pan,
      this._pan,
      this.context.currentTime
    );
  }
  
  /**
   * Get current pan position
   */
  getPan(): number {
    return this._pan;
  }
  
  /**
   * Mute/unmute this channel
   */
  setMute(muted: boolean): void {
    this._muted = muted;
    smoothParam(
      this.gainNode.gain,
      muted ? 0 : this._volume,
      this.context.currentTime
    );
  }
  
  /**
   * Get mute state
   */
  isMuted(): boolean {
    return this._muted;
  }
  
  /**
   * Toggle mute state
   */
  toggleMute(): void {
    this.setMute(!this._muted);
  }
  
  /**
   * Set solo state
   */
  setSolo(solo: boolean): void {
    this._solo = solo;
  }
  
  /**
   * Get solo state
   */
  isSolo(): boolean {
    return this._solo;
  }
  
  /**
   * Toggle solo state
   */
  toggleSolo(): void {
    this._solo = !this._solo;
  }
  
  /**
   * Set armed state for recording
   */
  setArmed(armed: boolean): void {
    this._armed = armed;
  }
  
  /**
   * Get armed state
   */
  isArmed(): boolean {
    return this._armed;
  }
  
  /**
   * Toggle armed state
   */
  toggleArmed(): void {
    this._armed = !this._armed;
  }

  /* ===========================
     FX Chain Management
  ============================ */
  
  /**
   * Add an effect to the FX chain
   */
  addFX(fx: FXNodeBase, index?: number): void {
    this.fxChain.addFXNode(fx, index);
  }
  
  /**
   * Remove an effect from the FX chain by ID
   */
  removeFX(fxId: string): void {
    this.fxChain.removeEffect(fxId);
  }
  
  /**
   * Move an effect within the FX chain
   */
  moveFX(fromIndex: number, toIndex: number): void {
    const effects = this.fxChain.getAllEffects();
    const fx = effects[fromIndex];
    if (fx) this.fxChain.reorderEffect(fx.id, toIndex);
  }
  
  /**
   * Load and add a VST plugin to this channel's FX chain
   * @param vstUrl - URL to the WASM VST file
   * @param workletName - Optional worklet processor name
   * @param config - Optional VST configuration
   * @returns Promise that resolves to the loaded VST node
   */
  async addVST(
    vstUrl: string, 
    workletName?: string,
    config?: any
  ): Promise<VSTFXNode> {
    try {
      const vstNode = await this.fxChain.addEffect(vstUrl, workletName, config);
      
      // Type assertion since we know addVSTEffect returns VSTFXNode
      if (!(vstNode instanceof VSTFXNode)) {
        throw new Error('Expected VSTFXNode but got different type');
      }
      
      return vstNode as VSTFXNode;
    } catch (error) {
      console.error(`Failed to add VST to channel ${this.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all effects in this channel's FX chain
   */
  getEffects(): FXNode[] {
    return this.fxChain.getAllEffects();
  }
  
  /**
   * Get a specific effect by ID
   */
  getEffect(fxId: string): FXNodeBase | undefined {
    return this.fxChain.getAllEffects().find(fx => fx.id === fxId);
  }
  
  /**
   * Get all VST plugins on this channel
   */
  getVSTPlugins(): VSTFXNode[] {
    return this.fxChain.getAllEffects().filter(fx => fx instanceof VSTFXNode) as VSTFXNode[];
  }
  
  /**
   * Clear all effects from the FX chain
   */
  clearFX(): void {
    const effects = [...this.fxChain.getAllEffects()];
    effects.forEach(fx => this.removeFX(fx.id));
  }

  /* ===========================
     Metering
  ============================ */
  
  /**
   * Update and get current meter level (0.0 to 1.0)
   */
  getMeterLevel(): number {
    this.analyserNode.getByteTimeDomainData(this.meterDataArray as Uint8Array<ArrayBuffer>);
    
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
    } else if (now - this.peakHoldTime > this.PEAK_HOLD_DURATION) {
      // Gradually decay peak
      this._peakLevel = Math.max(this._currentLevel, this._peakLevel * 0.95);
    }
    
    return this._currentLevel;
  }
  
  /**
   * Get peak level
   */
  getPeakLevel(): number {
    return this._peakLevel;
  }
  
  /**
   * Reset peak level
   */
  resetPeak(): void {
    this._peakLevel = 0;
    this.peakHoldTime = Date.now();
  }
  
  /**
   * Get frequency spectrum data
   */
  getFrequencyData(): Uint8Array {
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount) as unknown as Uint8Array;
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
  async deserialize(data: any): Promise<void> {
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
      restoredChain.effects.forEach(fx => {
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
  clone(newId: string): MixerChannel {
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
  reset(): void {
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
  isActive(): boolean {
    return this._currentLevel > 0.001 && !this._muted;
  }

  /* ===========================
     Cleanup
  ============================ */
  
  /**
   * Clean up all resources
   */
  dispose(): void {
    // Disconnect all nodes
    this.input.disconnect();
    this.panNode.disconnect();
    this.gainNode.disconnect();
    this.analyserNode.disconnect();
    this.output.disconnect();
    
    // Dispose FX chain
    (this.fxChain as any).dispose();
    
    // Reset state
    this._muted = false;
    this._solo = false;
    this._armed = false;
    this._currentLevel = 0;
    this._peakLevel = 0;
  }
  setDryWet(_dry: number, _wet: number): void {}

  private _name: string = '';
  get name(): string { return this._name || this.id; }
  setName(name: string): void { this._name = name; }

}

// Export type for external use
export type MixerChannelState = ReturnType<MixerChannel['getState']>;
export type SerializedMixerChannel = ReturnType<MixerChannel['serialize']>;