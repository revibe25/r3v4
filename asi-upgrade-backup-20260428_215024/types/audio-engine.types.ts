/**
 * Audio Engine Type Definitions
 * Complete type coverage for the unified audio engine
 */

/**
 * Track configuration for mixer channels
 */
export interface Track {
  id: string;
  name: string;
  volume?: number;      // 0.0 - 1.0
  pan?: number;         // -1.0 (left) to 1.0 (right)
  muted?: boolean;
  solo?: boolean;
  color?: string;
  type?: 'audio' | 'midi' | 'instrument';
  armed?: boolean;      // Ready for recording
}

/**
 * Audio engine state
 */
export interface AudioEngineState {
  isPlaying: boolean;
  isRecording: boolean;
  position: number;     // Current playback position in seconds
  bpm: number;
  volume: number;       // Master volume 0.0 - 1.0
  metering?: MeterData;
}

/**
 * Metering data for visual feedback
 */
export interface MeterData {
  level: number;        // RMS level in dB (-∞ to 0)
  peak: number;         // Peak level in dB (-∞ to 0)
  clipping: boolean;    // True if clipping detected
}

/**
 * Audio effect types
 */
export type FXType = 
  | 'eq'
  | 'compressor'
  | 'delay'
  | 'reverb'
  | 'distortion'
  | 'filter'
  | 'chorus'
  | 'phaser';

/**
 * Effect parameters
 */
export interface FXParams {
  type: FXType;
  bypassed?: boolean;
  wet?: number;         // 0.0 - 1.0
  dry?: number;         // 0.0 - 1.0
  [key: string]: any;   // Effect-specific parameters
}

/**
 * Sample data structure
 */
export interface Sample {
  id: string;
  name: string;
  buffer: AudioBuffer;
  duration: number;
  type: 'one-shot' | 'loop';
}

/**
 * Session export format
 */
export interface SessionData {
  version: string;
  bpm: number;
  tracks: Track[];
  clips: any[];
  automation: any[];
  timestamp: number;
}

/**
 * Keyboard mapping constants
 */
export const PAD_KEYS = [
  '1', '2', '3', '4',
  'q', 'w', 'e', 'r',
  'a', 's', 'd', 'f',
  'z', 'x', 'c', 'v'
] as const;

export const PIANO_KEYS = [
  'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'
] as const;

/**
 * Transport keyboard shortcuts
 */
export const TRANSPORT_KEYS = {
  PLAY_PAUSE: ' ',      // Space
  RECORD: 'Enter',
  STOP: 'Escape',
} as const;

/**
 * Unified Audio Engine Hook Return Type
 */
export interface UseAudioEngineReturn {
  // State
  state: AudioEngineState;
  isInitialized: boolean;
  channels: Map<string, any>;

  // Initialization
  init: () => Promise<void>;

  // Transport controls
  play: () => void;
  stop: () => void;
  record: () => void;
  arm?: (trackId: string) => void;

  // Mixer controls
  setChannelVolume: (trackId: string, volume: number) => void;
  setChannelPan: (trackId: string, pan: number) => void;
  setChannelMute: (trackId: string, muted: boolean) => void;
  setChannelSolo: (trackId: string, solo: boolean) => void;
  getChannel: (trackId: string) => any;

  // Pad/Key triggers
  triggerPad?: (index: number) => void;
  triggerKey?: (index: number) => void;

  // Effects
  toggleFX?: (trackId: string, fxType: FXType) => void;
  setFilter?: (trackId: string, frequency: number, resonance: number) => void;
  setPitch?: (trackId: string, semitones: number) => void;
  setCrossfade?: (value: number) => void;

  // Global controls
  setBpm: (bpm: number) => void;
  toggleMetronome?: () => void;

  // Analysis
  getAnalyserData?: (trackId: string) => Float32Array | null;
  getWaveformData?: (trackId: string) => Float32Array | null;

  // Sample management
  loadSample?: (file: File) => Promise<Sample>;
  assignPadSample?: (padIndex: number, sampleId: string) => void;
  assignKeySample?: (keyIndex: number, sampleId: string) => void;

  // Session management
  exportSession?: () => SessionData;
  importSession?: (data: SessionData) => Promise<void>;

  // History
  undo?: () => void;
  redo?: () => void;
}
