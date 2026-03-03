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
