// Shared effect types for R3VIBE Native

export type EffectType = 'reverb' | 'delay' | 'filter' | 'distortion' | 'compressor' | 'eq';

export interface EffectParams {
  enabled: boolean;
  wet: number;
  dry: number;
}

// REVERB — implementation uses decay + preDelay
export interface ReverbParams extends EffectParams {
  type: 'reverb';
  decay: number;
  preDelay: number;
  // legacy UI fields — optional
  roomSize?: number;
  damping?: number;
  width?: number;
  reverbType?: 'room' | 'hall' | 'plate';
}

// DELAY — implementation uses delayTime + feedback
export interface DelayParams extends EffectParams {
  type: 'delay';
  delayTime: number;
  feedback: number;
  // legacy fields — optional
  time?: number;
  syncToTempo?: boolean;
  tempoMultiplier?: 0.25 | 0.5 | 1 | 2 | 4;
}

// FILTER — implementation uses frequency + resonance + filterType + rolloff
export interface FilterParams extends EffectParams {
  type: 'filter';
  frequency: number;
  resonance: number;
  filterType: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
  rolloff?: number;
  drive?: number;
}

// DISTORTION — implementation uses drive
export interface DistortionParams extends EffectParams {
  type: 'distortion';
  drive: number;
  // legacy fields — optional
  amount?: number;
  tone?: number;
  oversample?: 'none' | '2x' | '4x';
}

// COMPRESSOR
export interface CompressorParams extends EffectParams {
  type: 'compressor';
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeup: number;
  knee: number;
}

// EQ
export interface EQParams extends EffectParams {
  type: 'eq';
  low: number;
  mid: number;
  high: number;
  lowFreq: number;
  midFreq: number;
  highFreq: number;
}

export type AnyEffectParams =
  | ReverbParams
  | DelayParams
  | FilterParams
  | DistortionParams
  | CompressorParams
  | EQParams;

export interface EffectChainNode {
  id: string;
  type: EffectType;
  params: AnyEffectParams;
  bypass: boolean;
}

export interface EffectChain {
  id: string;
  name: string;
  nodes: EffectChainNode[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EffectPreset {
  id: string;
  name: string;
  category: string;
  chain: EffectChain;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isPremium: boolean;
  author?: string;
}

export interface AutomationPoint {
  time: number;
  value: number;
}

export interface ParameterAutomation {
  nodeId: string;
  parameterName: string;
  points: AutomationPoint[];
  enabled: boolean;
}

export interface AutomationTrack {
  id: string;
  automations: ParameterAutomation[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EffectPresetResponse {
  id: string;
  name: string;
  category: string;
  tags: string[];
  isPremium: boolean;
  author?: string;
}

export interface EffectChainResponse {
  id: string;
  name: string;
  nodes: Array<{ id: string; type: EffectType; params: AnyEffectParams; bypass: boolean }>;
}
