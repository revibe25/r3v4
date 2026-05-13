/**
 * Audio Helpers
 * 
 * Utility functions for audio processing, conversions, and common operations.
 * 
 * @module utils/audioHelpers
 */

import type {
  AudioEffect,
  EffectState,
  MixerChannelState,
  ProjectState
} from '@/types/audio';

// ============================================
// AUDIO CONVERSIONS
// ============================================

/**
 * Convert linear gain (0-1) to decibels
 */
export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
}

/**
 * Convert decibels to linear gain (0-1)
 */
export function dbToGain(db: number): number {
  if (db === -Infinity) return 0;
  return Math.pow(10, db / 20);
}

/**
 * Convert frequency to MIDI note number
 */
export function frequencyToMidi(frequency: number): number {
  return 12 * Math.log2(frequency / 440) + 69;
}

/**
 * Convert MIDI note number to frequency
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert pan value (-1 to 1) to stereo gains
 */
export function panToGains(pan: number): { left: number; right: number } {
  const clampedPan = Math.max(-1, Math.min(1, pan));
  const panRadians = (clampedPan + 1) * (Math.PI / 4);
  
  return {
    left: Math.cos(panRadians),
    right: Math.sin(panRadians),
  };
}

/**
 * Convert seconds to bars:beats:ticks format
 */
export function secondsToBarsBeatsTicks(
  seconds: number,
  bpm: number,
  timeSignature: { numerator: number; denominator: number }
): { bars: number; beats: number; ticks: number } {
  const beatsPerBar = timeSignature.numerator;
  const ticksPerBeat = 480; // Standard MIDI resolution
  
  const totalBeats = (seconds / 60) * bpm;
  const bars = Math.floor(totalBeats / beatsPerBar);
  const beats = Math.floor(totalBeats % beatsPerBar);
  const ticks = Math.floor((totalBeats % 1) * ticksPerBeat);
  
  return { bars, beats, ticks };
}

/**
 * Convert bars:beats:ticks to seconds
 */
export function barsBeatTicksToSeconds(
  bars: number,
  beats: number,
  ticks: number,
  bpm: number,
  timeSignature: { numerator: number; denominator: number }
): number {
  const beatsPerBar = timeSignature.numerator;
  const ticksPerBeat = 480;
  
  const totalBeats = (bars * beatsPerBar) + beats + (ticks / ticksPerBeat);
  return (totalBeats / bpm) * 60;
}

// ============================================
// AUDIO BUFFER UTILITIES
// ============================================

/**
 * Create a silent audio buffer
 */
export function createSilentBuffer(
  audioContext: AudioContext,
  duration: number,
  channels: number = 2
): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const length = Math.floor(sampleRate * duration);
  
  return audioContext.createBuffer(channels, length, sampleRate);
}

/**
 * Mix two audio buffers together
 */
export function mixBuffers(
  buffer1: AudioBuffer,
  buffer2: AudioBuffer,
  ratio: number = 0.5
): AudioBuffer {
  const channels = Math.min(buffer1.numberOfChannels, buffer2.numberOfChannels);
  const length = Math.max(buffer1.length, buffer2.length);
  const sampleRate = buffer1.sampleRate;
  
  const mixedBuffer = new AudioBuffer({
    numberOfChannels: channels,
    length,
    sampleRate,
  });
  
  for (let channel = 0; channel < channels; channel++) {
    const data1 = buffer1.getChannelData(channel);
    const data2 = buffer2.getChannelData(channel);
    const mixed = mixedBuffer.getChannelData(channel);
    
    for (let i = 0; i < length; i++) {
      const sample1 = i < data1.length ? data1[i] : 0;
      const sample2 = i < data2.length ? data2[i] : 0;
      mixed[i] = (sample1 * ratio) + (sample2 * (1 - ratio));
    }
  }
  
  return mixedBuffer;
}

/**
 * Normalize audio buffer to target peak level
 */
export function normalizeBuffer(
  buffer: AudioBuffer,
  targetLevel: number = 0.95
): AudioBuffer {
  const channels = buffer.numberOfChannels;
  const normalized = new AudioBuffer({
    numberOfChannels: channels,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
  });
  
  // Find peak
  let peak = 0;
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  
  // Calculate gain
  const gain = peak > 0 ? targetLevel / peak : 1;
  
  // Apply gain
  for (let channel = 0; channel < channels; channel++) {
    const source = buffer.getChannelData(channel);
    const dest = normalized.getChannelData(channel);
    
    for (let i = 0; i < source.length; i++) {
      dest[i] = source[i] * gain;
    }
  }
  
  return normalized;
}

// ============================================
// EFFECT UTILITIES
// ============================================

/**
 * Clone an effect state
 */
export function cloneEffectState(state: EffectState): EffectState {
  return {
    ...state,
    parameters: { ...state.parameters },
    metadata: state.metadata ? { ...state.metadata } : undefined,
  };
}

/**
 * Compare two effect states for equality
 */
export function areEffectStatesEqual(
  state1: EffectState,
  state2: EffectState
): boolean {
  if (state1.id !== state2.id) return false;
  if (state1.type !== state2.type) return false;
  if (state1.enabled !== state2.enabled) return false;
  if (state1.bypassed !== state2.bypassed) return false;
  if (state1.wet !== state2.wet) return false;
  
  // Compare parameters
  const keys1 = Object.keys(state1.parameters);
  const keys2 = Object.keys(state2.parameters);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => state1.parameters[key] === state2.parameters[key]);
}

// ============================================
// CHANNEL UTILITIES
// ============================================

/**
 * Clone a mixer channel state
 */
export function cloneChannelState(state: MixerChannelState): MixerChannelState {
  return {
    ...state,
  };
}

/**
 * Validate mixer channel state
 */
export function validateChannelState(state: MixerChannelState): boolean {
  return (
    typeof state.id === 'string' &&
    typeof state.name === 'string' &&
    typeof state.volume === 'number' &&
    state.volume >= 0 && state.volume <= 1 &&
    typeof state.pan === 'number' &&
    state.pan >= -1 && state.pan <= 1 &&
    typeof state.solo === 'boolean' &&
    typeof state.mute === 'boolean'
  );
}

// ============================================
// PROJECT UTILITIES
// ============================================

/**
 * Create a new empty project state
 */
export function createEmptyProject(name: string = 'Untitled Project'): ProjectState {
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    metadata: {
      name,
      created: Date.now(),
      modified: Date.now(),
      bpm: 120,
      timeSignature: '4/4',
    },
    sampleRate: 48000,
    bufferSize: 512,
    channels: [],
    masterBus: {
      volume: 0.8,
      limiterEnabled: true,
    },
    effectChains: [],
    sidechains: {
      connections: [],
      timestamp: Date.now(),
    },
    automation: {
      lanes: [],
      timestamp: Date.now(),
    },
  };
}

/**
 * Validate project state
 */
export function validateProjectState(state: any): state is ProjectState {
  return (
    state &&
    typeof state.version === 'string' &&
    typeof state.timestamp === 'number' &&
    state.metadata &&
    typeof state.metadata.name === 'string' &&
    typeof state.sampleRate === 'number' &&
    typeof state.bufferSize === 'number' &&
    Array.isArray(state.channels) &&
    state.masterBus &&
    Array.isArray(state.effectChains) &&
    state.sidechains &&
    state.automation
  );
}

/**
 * Calculate project file size estimate (in MB)
 */
export function estimateProjectSize(state: ProjectState): number {
  const json = JSON.stringify(state);
  return new Blob([json]).size / (1024 * 1024);
}

// ============================================
// PERFORMANCE UTILITIES
// ============================================

/**
 * Calculate RMS (Root Mean Square) of audio data
 */
export function calculateRMS(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
}

/**
 * Calculate peak level of audio data
 */
export function calculatePeak(data: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    peak = Math.max(peak, Math.abs(data[i]));
  }
  return peak;
}

/**
 * Smooth a value using exponential moving average
 */
export function smoothValue(
  currentValue: number,
  targetValue: number,
  smoothingFactor: number = 0.3
): number {
  return currentValue + (targetValue - currentValue) * smoothingFactor;
}

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format decibels for display
 */
export function formatDb(db: number, decimals: number = 1): string {
  if (db === -Infinity) return '-∞ dB';
  return `${db.toFixed(decimals)} dB`;
}

/**
 * Format frequency for display
 */
export function formatFrequency(frequency: number): string {
  if (frequency >= 1000) {
    return `${(frequency / 1000).toFixed(1)} kHz`;
  }
  return `${Math.round(frequency)} Hz`;
}

/**
 * Format time for display
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  
  return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}