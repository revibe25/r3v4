// @ts-nocheck
// client/src/audio/fx/vst-automation-engine.ts
import {
  AutomationEngine,
  AutomationLane as IAutomationLane,
  AutomationPoint,
  AutomationTarget,
  AutomationLaneState,
  AutomationEngineState,
  AutomationCurve
} from '@/types/audio';

export interface LFOConfig {
  waveform: 'sine' | 'triangle' | 'square' | 'saw' | 'random';
  frequency: number;
  depth: number;
  phase: number;
  sync: boolean;
}

export interface EnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export class VSTAutomationEngine implements AutomationEngine {
  // ── AutomationEngine interface implementation ──────────────
  readonly lanes: Map<string, IAutomationLane> = new Map();
  currentTime: number = 0;

  createLane(id: string, paramPath: string): IAutomationLane {
    const lane = { id, points: [], enabled: true, paramPath } as unknown as IAutomationLane;
    this.lanes.set(id, lane);
    return lane;
  }
  removeLane(id: string): void { this.lanes.delete(id); }
  getLane(id: string): IAutomationLane | undefined { return this.lanes.get(id); }
  getAllLanes(): IAutomationLane[] { return Array.from(this.lanes.values()); }
  clearLane(id: string): void { const l = this.lanes.get(id); if (l) (l as any).points = []; }
  clearAll(): void { this.lanes.forEach((_: IAutomationLane, id: string) => this.clearLane(id)); }
  setCurrentTime(t: number): void { this.currentTime = t; }
  getValueAtTime(_laneId: string, _t: number): number { return 0; }
  // ──────────────────────────────────────────────────────────

  private audioContext: AudioContext;
  private automationLanes: Map<string, AutomationLaneImpl> = new Map();
  private lfos: Map<string, LFO> = new Map();
  private envelopes: Map<string, Envelope> = new Map();
  private playbackPosition: number = 0;
  private isPlaying: boolean = false;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  createAutomationLane(id: string, paramId: number, points: AutomationPoint[]): void {
    const lane = new AutomationLaneImpl(id, paramId, points, this.audioContext);
    this.automationLanes.set(id, lane);
  }

  createLFO(id: string, paramId: number, config: LFOConfig): void {
    const lfo = new LFO(id, paramId, config, this.audioContext);
    this.lfos.set(id, lfo);
  }

  createEnvelope(id: string, paramId: number, config: EnvelopeConfig): void {
    const envelope = new Envelope(id, paramId, config, this.audioContext);
    this.envelopes.set(id, envelope);
  }

  getAutomationValue(paramId: number, time: number): number {
    let value = 0;
    let hasAutomation = false;

    this.automationLanes.forEach(lane => {
      if (lane.paramId === paramId && lane.enabled) {
        value = lane.getValueAtTime(time);
        hasAutomation = true;
      }
    });

    this.lfos.forEach(lfo => {
      if (lfo.paramId === paramId && lfo.enabled) {
        const lfoValue = lfo.getValueAtTime(time);
        value = hasAutomation ? value + lfoValue * lfo.config.depth : lfoValue;
        hasAutomation = true;
      }
    });

    return hasAutomation ? Math.max(0, Math.min(1, value)) : value;
  }

  triggerEnvelope(id: string): void { this.envelopes.get(id)?.trigger(); }
  releaseEnvelope(id: string): void { this.envelopes.get(id)?.release(); }

  start(): void {
    this.isPlaying = true;
    this.playbackPosition = this.audioContext.currentTime;
  }
  stop():  void { this.isPlaying = false; }
  pause(): void { this.isPlaying = false; }

  update(): void {
    if (this.isPlaying) this.playbackPosition = this.audioContext.currentTime;
  }

  dispose(): void {
    this.automationLanes.clear();
    this.lfos.forEach(lfo => lfo.dispose());
    this.lfos.clear();
    this.envelopes.clear();
  }
}

// ── Internal implementation classes ───────────────────────────

class AutomationLaneImpl {
  id: string;
  paramId: number;
  points: AutomationPoint[];
  enabled: boolean = true;
  private audioContext: AudioContext;

  constructor(id: string, paramId: number, points: AutomationPoint[], audioContext: AudioContext) {
    this.id = id;
    this.paramId = paramId;
    this.points = [...points].sort((a, b) => a.time - b.time);
    this.audioContext = audioContext;
  }

  getValueAtTime(time: number): number {
    if (this.points.length === 0) return 0;
    if (time <= this.points[0].time) return this.points[0].value;
    if (time >= this.points[this.points.length - 1].time)
      return this.points[this.points.length - 1].value;

    let i = 0;
    while (i < this.points.length - 1 && this.points[i + 1].time <= time) i++;

    const p1 = this.points[i];
    const p2 = this.points[i + 1];
    if (!p2) return p1.value;

    const t = (time - p1.time) / (p2.time - p1.time);
    return this.interpolate(p1.value, p2.value, t, p1.curve);
  }

  private interpolate(v1: number, v2: number, t: number, curve: AutomationCurve | undefined): number {
    switch (curve) {
      case AutomationCurve.EXPONENTIAL:
        return v1 * Math.pow(v2 / v1, t);
      case AutomationCurve.LOGARITHMIC:
        return v1 + (v2 - v1) * Math.log(1 + t * (Math.E - 1)) / Math.log(Math.E);
      case AutomationCurve.SMOOTH: {
        const s = t * t * (3 - 2 * t);
        return v1 + (v2 - v1) * s;
      }
      case AutomationCurve.STEP:
        return t < 0.5 ? v1 : v2;
      case AutomationCurve.LINEAR:
      default:
        return v1 + (v2 - v1) * t;
    }
  }

  addPoint(point: AutomationPoint): void {
    this.points.push(point);
    this.points.sort((a, b) => a.time - b.time);
  }
  removePoint(time: number): void { this.points = this.points.filter(p => p.time !== time); }
  updatePoint(time: number, value: number): void {
    const p = this.points.find(p => p.time === time);
    if (p) p.value = value;
  }
}

class LFO {
  id: string;
  paramId: number;
  config: LFOConfig;
  enabled: boolean = true;
  private audioContext: AudioContext;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  constructor(id: string, paramId: number, config: LFOConfig, audioContext: AudioContext) {
    this.id = id;
    this.paramId = paramId;
    this.config = config;
    this.audioContext = audioContext;
    this.createOscillator();
  }

  private createOscillator(): void {
    this.oscillator = this.audioContext.createOscillator();
    this.gainNode   = this.audioContext.createGain();
    this.oscillator.type = this.config.waveform as OscillatorType;
    this.oscillator.frequency.value = this.config.frequency;
    this.gainNode.gain.value = this.config.depth;
    this.oscillator.connect(this.gainNode);
    this.oscillator.start();
  }

  getValueAtTime(time: number): number {
    const phase = (time * this.config.frequency + this.config.phase) % 1;
    switch (this.config.waveform) {
      case 'sine':     return Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
      case 'triangle': return phase < 0.5 ? phase * 2 : 2 - phase * 2;
      case 'square':   return phase < 0.5 ? 0 : 1;
      case 'saw':      return phase;
      case 'random':   return Math.random();
      default:         return 0.5;
    }
  }

  updateConfig(config: Partial<LFOConfig>): void {
    Object.assign(this.config, config);
    if (this.oscillator && config.frequency !== undefined)
      this.oscillator.frequency.setValueAtTime(config.frequency, this.audioContext.currentTime);
    if (this.gainNode && config.depth !== undefined)
      this.gainNode.gain.setValueAtTime(config.depth, this.audioContext.currentTime);
  }

  dispose(): void {
    if (this.oscillator) { this.oscillator.stop(); this.oscillator.disconnect(); }
    if (this.gainNode)   { this.gainNode.disconnect(); }
  }
}

class Envelope {
  id: string;
  paramId: number;
  config: EnvelopeConfig;
  private audioContext: AudioContext;
  private stage: 'idle' | 'attack' | 'decay' | 'sustain' | 'release' = 'idle';
  private startTime: number = 0;
  private releaseStartTime: number = 0;

  constructor(id: string, paramId: number, config: EnvelopeConfig, audioContext: AudioContext) {
    this.id = id;
    this.paramId = paramId;
    this.config = config;
    this.audioContext = audioContext;
  }

  trigger(): void {
    this.startTime = this.audioContext.currentTime;
    this.stage = 'attack';
  }

  release(): void {
    this.releaseStartTime = this.audioContext.currentTime;
    this.stage = 'release';
  }

  getValueAtTime(time: number): number {
    if (this.stage === 'idle') return 0;

    const elapsed = time - this.startTime;

    if (this.stage === 'attack') {
      if (elapsed < this.config.attack) return elapsed / this.config.attack;
      this.stage = 'decay';
    }

    if (this.stage === 'decay') {
      const decayElapsed = elapsed - this.config.attack;
      if (decayElapsed < this.config.decay) {
        return 1 - (1 - this.config.sustain) * (decayElapsed / this.config.decay);
      }
      this.stage = 'sustain';
    }

    if (this.stage === 'sustain') return this.config.sustain;

    if (this.stage === 'release') {
      const releaseElapsed = time - this.releaseStartTime;
      if (releaseElapsed < this.config.release) {
        return this.config.sustain * (1 - releaseElapsed / this.config.release);
      }
      this.stage = 'idle';
      return 0;
    }

    return 0;
  }
}
