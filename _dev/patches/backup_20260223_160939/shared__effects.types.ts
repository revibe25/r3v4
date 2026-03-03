// Shared effect types for R3VIBE Native

export type EffectType = 'reverb' | 'delay' | 'filter' | 'distortion' | 'compressor' | 'eq';

export interface EffectParams {
  enabled: boolean;
  wet: number; // 0-1
  dry: number; // 0-1
}

// REVERB
export interface ReverbParams extends EffectParams {
  decay?: number;       // seconds — used by ReverbEffect
  preDelay?: number;    // seconds — used by ReverbEffect
  type: 'reverb';
  roomSize: number; // 0-1
  damping: number; // 0-1
  width: number; // 0-1
  reverbType: 'room' | 'hall' | 'plate';
}

// DELAY
export interface DelayParams extends EffectParams {
  delayTime?: number;   // seconds — used by DelayEffect
  type: 'delay';
  time: number; // milliseconds, 1-2000
  feedback: number; // 0-0.9
  syncToTempo: boolean;
  tempoMultiplier: 0.25 | 0.5 | 1 | 2 | 4; // 1/16 to 4 bars
}

// FILTER
export interface FilterParams extends EffectParams {
  rolloff?: number;     // -12 | -24 | -48
  type: 'filter';
  frequency: number; // 20-20000 Hz
  resonance: number; // 0-40
  filterType: 'lowpass' | 'highpass' | 'bandpass';
  drive: number; // 0-1
}

// DISTORTION
export interface DistortionParams extends EffectParams {
  type: 'distortion';
  amount: number; // 0-1
  tone: number; // 0-1
  oversample: 'none' | '2x' | '4x';
}

// COMPRESSOR
export interface CompressorParams extends EffectParams {
  type: 'compressor';
  threshold: number; // -100 to 0 dB
  ratio: number; // 1-20
  attack: number; // 0-1000 ms
  release: number; // 10-3000 ms
  makeup: number; // 0-40 dB
  knee: number; // 0-40
}

// EQ
export interface EQParams extends EffectParams {
  type: 'eq';
  low: number; // -12 to +12 dB (60 Hz)
  mid: number; // -12 to +12 dB (1000 Hz)
  high: number; // -12 to +12 dB (12000 Hz)
  lowFreq: number; // 20-200 Hz
  midFreq: number; // 200-4000 Hz
  highFreq: number; // 4000-20000 Hz
}

export type AnyEffectParams = 
  | ReverbParams 
  | DelayParams 
  | FilterParams 
  | DistortionParams 
  | CompressorParams 
  | EQParams;

// EFFECT CHAIN
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

// PRESET
export interface EffectPreset {
  id: string;
  name: string;
  category: string; // 'vocal', 'drum', 'synth', 'guitar', 'custom'
  chain: EffectChain;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isPremium: boolean;
  author?: string;
}

// AUTOMATION
export interface AutomationPoint {
  time: number; // in milliseconds
  value: number; // 0-1 normalized
}

export interface ParameterAutomation {
  nodeId: string;
  parameterName: string; // e.g., 'delay.time', 'reverb.roomSize'
  points: AutomationPoint[];
  enabled: boolean;
}

export interface AutomationTrack {
  id: string;
  automations: ParameterAutomation[];
  createdAt: Date;
  updatedAt: Date;
}

// API RESPONSES
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
  nodes: Array<{
    id: string;
    type: EffectType;
    params: AnyEffectParams;
    bypass: boolean;
  }>;
}