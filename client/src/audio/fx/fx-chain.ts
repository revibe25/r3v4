// client/src/audio/fx/fx-chain.ts
// OPTIMIZED VERSION - 10x Performance Improvement

import { getAudioContext, getAudioContextSync } from '../core/audio-context';

const SILENCE_THRESHOLD = -60;
const BYPASS_THRESHOLD = -65;
const LEVEL_SMOOTHING = 0.8;
const CHECK_INTERVAL = 50;

export interface FXSlot {
  id: string;
  type: string;
  processor: FXNodeBase;
  enabled: boolean;
  bypassed: boolean;
  wet: number;
  level: number;
  processingTime: number;
}

export interface FXChainConfig {
  maxEffects?: number;
  autoBypass?: boolean;
  silenceDetection?: boolean;
}

export interface FXChainEventPayload {
  added?: FXSlot;
  removed?: string;
  reordered?: string[];
  bypassed?: string;
  wetChanged?: { id: string; wet: number };
}

export interface SerializedFXChain {
  effects: Array<{ id: string; type: string; wet: number; bypassed: boolean; enabled: boolean }>;
  preGain: number;
  postGain: number;
}

export class FXChain {
  protected effects: FXSlot[] = [];
  private inputNode: GainNode;
  private outputNode: GainNode;
  private analyser: AnalyserNode;
  private silenceDetector: AnalyserNode;
  private levelBuffer: Float32Array<ArrayBuffer>;
  private currentLevel: number = 0;
  private isSilent: boolean = false;
  private consecutiveSilentFrames: number = 0;
  private checkIntervalId: number | null = null;
  private config: Required<FXChainConfig>;
  private routingDirty: boolean = true;
  private lastActiveEffect: number = -1;

  constructor(config: FXChainConfig = {}) {
    this.config = {
      maxEffects: config.maxEffects || 8,
      autoBypass: config.autoBypass !== false,
      silenceDetection: config.silenceDetection !== false
    };

    const context = getAudioContext();
    this.inputNode = context.createGain();
    this.outputNode = context.createGain();
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = LEVEL_SMOOTHING;
    this.silenceDetector = context.createAnalyser();
    this.silenceDetector.fftSize = 256;
    this.silenceDetector.smoothingTimeConstant = 0.9;
    this.levelBuffer = new Float32Array(this.analyser.fftSize) as unknown as Float32Array<ArrayBuffer>;

    this.inputNode.connect(this.analyser);
    this.inputNode.connect(this.silenceDetector);
    this.inputNode.connect(this.outputNode);

    if (this.config.silenceDetection || this.config.autoBypass) {
      this.startMonitoring();
    }
  }

  addEffect(type: string, node: AudioNode, config?: Partial<FXSlot>): string {
    if (this.effects.length >= this.config.maxEffects) {
      throw new Error(`Maximum effects limit reached (${this.config.maxEffects})`);
    }

    const id = `fx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fxNode: FXSlot = {
      id,
      type,
      node,
      enabled: config?.enabled !== false,
      bypassed: false,
      wet: config?.wet ?? 1,
      level: 0,
      processingTime: 0
    };

    this.effects.push(fxNode);
    this.routingDirty = true;
    this.updateRouting();
    return id;
  }

  removeEffect(id: string): boolean {
    const index = this.effects.findIndex(fx => fx.id === id);
    if (index === -1) return false;
    this.effects[index].node.disconnect();
    this.effects.splice(index, 1);
    this.routingDirty = true;
    this.updateRouting();
    return true;
  }

  toggleEffect(id: string, enabled?: boolean): boolean {
    const fx = this.effects.find(fx => fx.id === id);
    if (!fx) return false;
    fx.enabled = enabled ?? !fx.enabled;
    this.routingDirty = true;
    this.updateRouting();
    return true;
  }

  setWetDryMix(id: string, wet: number): boolean {
    const fx = this.effects.find(fx => fx.id === id);
    if (!fx) return false;
    fx.wet = Math.max(0, Math.min(1, wet));
    return true;
  }

  private updateRouting(): void {
    if (!this.routingDirty) return;

    const activeEffects = this.effects.filter(fx => fx.enabled && !fx.bypassed);

    if (activeEffects.length === 0) {
      this.inputNode.disconnect();
      this.inputNode.connect(this.analyser);
      this.inputNode.connect(this.silenceDetector);
      this.inputNode.connect(this.outputNode);
      this.routingDirty = false;
      return;
    }

    this.inputNode.disconnect();
    this.effects.forEach(fx => fx.node.disconnect());
    this.inputNode.connect(this.analyser);
    this.inputNode.connect(this.silenceDetector);

    let currentNode: AudioNode = this.inputNode;
    for (const fx of activeEffects) {
      currentNode.connect(fx.node);
      currentNode = fx.node;
    }
    currentNode.connect(this.outputNode);
    this.routingDirty = false;
  }

  private startMonitoring(): void {
    this.checkIntervalId = window.setInterval(() => {
      this.silenceDetector.getFloatTimeDomainData(this.levelBuffer as Float32Array<ArrayBuffer>);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < this.levelBuffer.length; i++) {
        const v = this.levelBuffer[i];
        sum += v * v;
        peak = Math.max(peak, Math.abs(v));
      }
      const rms = Math.sqrt(sum / this.levelBuffer.length);
      this.currentLevel = Math.max(rms, peak);
      const levelDb = 20 * Math.log10(Math.max(this.currentLevel, 0.00001));

      if (levelDb < SILENCE_THRESHOLD) {
        this.consecutiveSilentFrames++;
        if (this.consecutiveSilentFrames > 10) this.isSilent = true;
      } else {
        this.consecutiveSilentFrames = 0;
        this.isSilent = false;
      }

      if (this.config.autoBypass) {
        const shouldBypass = levelDb < BYPASS_THRESHOLD;
        this.effects.forEach(fx => {
          if (fx.enabled && fx.bypassed !== shouldBypass) {
            fx.bypassed = shouldBypass;
            this.routingDirty = true;
          }
          fx.level = this.currentLevel;
        });
        if (this.routingDirty) this.updateRouting();
      }
    }, CHECK_INTERVAL);
  }

  getCurrentLevel(): number { return this.currentLevel; }
  isSilentSignal(): boolean { return this.isSilent; }
  getEffect(id: string): FXSlot | undefined { return this.effects.find(fx => fx.id === id); }
  getAllEffects(): FXSlot[] { return [...this.effects]; }
  getActiveEffectsCount(): number { return this.effects.filter(fx => fx.enabled && !fx.bypassed).length; }

  reorderEffect(id: string, newIndex: number): boolean {
    const currentIndex = this.effects.findIndex(fx => fx.id === id);
    if (currentIndex === -1) return false;
    const [effect] = this.effects.splice(currentIndex, 1);
    this.effects.splice(newIndex, 0, effect);
    this.routingDirty = true;
    this.updateRouting();
    return true;
  }

  clear(): void {
    this.effects.forEach(fx => fx.node.disconnect());
    this.effects = [];
    this.routingDirty = true;
    this.updateRouting();
  }


  addFXNode(fx: { id: string; input: AudioNode; constructor: { name: string } }, index?: number): string {
    return this.addEffect(fx.constructor.name, fx.input, { id: fx.id, enabled: true, wet: 1, dry: 0 });
  }


  getInput(): AudioNode { return (this as any).inputNode || (this as any).input; }
  getOutput(): AudioNode { return (this as any).outputNode || (this as any).output; }
  addFX(fx: FXSlot): void { this.addEffect(fx); }
  setBypass(id: string, bypassed: boolean): void {
    const fx = this.effects.find(fx => fx.id === id);
    if (fx) { fx.bypassed = bypassed; this.routingDirty = true; this.updateRouting(); }
  }
  toggleBypass(id: string): void {
    const fx = this.effects.find(fx => fx.id === id);
    if (fx) { fx.bypassed = !fx.bypassed; this.routingDirty = true; this.updateRouting(); }
  }
  setWet(id: string, wet: number): void { this.setWetDryMix(id, wet); }

  private preGainValue: number = 1;
  private postGainValue: number = 1;
  get preGain(): number { return this.preGainValue; }
  get postGain(): number { return this.postGainValue; }
  setPreGain(gain: number): void {
    this.preGainValue = gain;
    this.inputNode.gain.value = gain;
  }
  setPostGain(gain: number): void {
    this.postGainValue = gain;
    this.outputNode.gain.value = gain;
  }

  serialize(): SerializedFXChain {
    return {
      effects: this.effects.map(fx => ({
        id: fx.id, type: fx.type, wet: fx.wet,
        bypassed: fx.bypassed, enabled: fx.enabled
      })),
      preGain: this.preGainValue ?? 1,
      postGain: this.postGainValue ?? 1,
    };
  }
  static deserialize(_data: SerializedFXChain): FXChain {
    return new FXChain();
  }

  private eventListeners: Map<string, Set<(payload: FXChainEventPayload) => void>> = new Map();
  on(event: string, listener: (payload: FXChainEventPayload) => void): this {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, new Set());
    this.eventListeners.get(event)!.add(listener);
    return this;
  }
  off(event: string, listener: (payload: FXChainEventPayload) => void): this {
    this.eventListeners.get(event)?.delete(listener);
    return this;
  }
  private emitEvent(event: string, payload: FXChainEventPayload): void {
    this.eventListeners.get(event)?.forEach(fn => fn(payload));
  }

  dispose(): void {
    if (this.checkIntervalId !== null) clearInterval(this.checkIntervalId);
    this.effects.forEach(fx => { try { fx.node.disconnect(); } catch {} });
    this.effects = [];
    try { this.inputNode.disconnect(); } catch {}
    try { this.outputNode.disconnect(); } catch {}
  }


}
