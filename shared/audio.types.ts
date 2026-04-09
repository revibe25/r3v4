/**
 * Shared Audio Type Definitions
 * Clean canonical version
 */

export type AudioChannelType = 'mono' | 'stereo' | 'midi' | 'bus' | 'master';

export type AudioState = 'stopped' | 'playing' | 'recording' | 'paused';

export interface GainState {
  linear: number;
  decibels: number;
}

export interface PanState {
  position: number; // -1 (L) to 1 (R)
  law?: string;
}

export interface MeterData {
  peak: number;
  rms: number;
  hold?: number;
  timestamp?: number;
}

export interface AudioRouting {
  input: string;
  output: string;
  sends: string[];
}

// ─── §SES.17 additions — SidechainConfig, AudioEffect, EffectChain, etc. ───────
// Added by r3-fix-ses.py to resolve TS2305 in effect-chain.ts, mixer-channel.ts,
// vst-sidechain.ts.  DO NOT remove this block; it is idempotency-guarded.

export interface SidechainConfig {
  sourceTrackId: string;
  threshold:     number;
  attack:        number;
  release:       number;
  enabled:       boolean;
}

export interface AudioEffect {
  id:         string;
  type:       string;
  name:       string;
  bypassed:   boolean;
  parameters: Record<string, number | boolean | string>;
}

export interface EffectChain {
  ownerId: string;
  effects: AudioEffect[];
}

export interface EffectChainState {
  ownerId:   string;
  effects:   AudioEffect[];
  updatedAt: string;
}

export interface MixerChannelConfig {
  id:        string;
  name:      string;
  volume:    number;
  pan:       number;
  muted:     boolean;
  soloed:    boolean;
  chain:     EffectChain;
  sidechain: SidechainConfig | null;
}

// AutomationPoint fix — adds .time and "exponential" curve type
export type CurveType = "linear" | "bezier" | "exponential" | "step";

export interface AutomationPoint {
  id:         string;
  time:       number;
  value:      number;
  curve:      CurveType;
  handleIn?:  [number, number];
  handleOut?: [number, number];
}
// ─── end §SES.17 additions ────────────────────────────────────────────────────
