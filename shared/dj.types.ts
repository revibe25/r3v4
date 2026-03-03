// Shared DJ control types for R3VIBE Native

// CROSSFADER
export interface CrossfaderConfig {
  curve: 'linear' | 'easein' | 'easeout' | 'smooth'; // Crossfade curve type
  range: number; // -1 (channel A) to +1 (channel B)
  sensitivity: number; // 0-1, affects response speed
}

export interface CrossfaderState extends CrossfaderConfig {
  leftVolume: number; // 0-1
  rightVolume: number; // 0-1
  latency: number; // milliseconds (target <5ms)
}

// TEMPO & PITCH
export interface TempoControlState {
  bpm: number; // 40-240
  pitchShift: number; // -50 to +50 semitones
  tempoRatio: number; // 0.5 to 2.0 (±50%)
  syncToMaster: boolean;
  beatAligned: boolean; // Snap to beat on tempo change
}

// HOT CUES
export interface HotCue {
  id: string;
  index: number; // 1-8
  position: number; // In seconds
  isActive: boolean;
  color: string; // Hex color for UI
  label?: string;
}

export interface HotCuesState {
  cues: HotCue[];
  selectedCue?: string;
  trackId: string;
}

export type CueColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'white';

const CUE_COLORS: Record<CueColor, string> = {
  red: '#EF4444',
  orange: '#F97316',
  yellow: '#EAB308',
  green: '#22C55E',
  blue: '#3B82F6',
  purple: '#8B5CF6',
  pink: '#EC4899',
  white: '#F5F5F5',
};

// BEAT SYNC
export interface BeatSyncConfig {
  enabled: boolean;
  masterBpm: number;
  beatDivision: 0.25 | 0.5 | 1 | 2 | 4; // 1/16 beat, 1/8, 1/4, 1/2, full beat
  snapThreshold: number; // milliseconds
  autoSync: boolean; // Auto-sync on cue point trigger
}

export interface BeatGridMarker {
  position: number; // in seconds
  beatNumber: number;
  isMajorBeat: boolean; // Every 4th beat
}

export interface BeatGrid {
  bpm: number;
  downbeatOffset: number; // milliseconds offset to first beat
  markers: BeatGridMarker[];
}

// CHANNEL FILTER
export interface ChannelFilterConfig {
  type: 'lowpass' | 'highpass' | 'bandpass';
  frequency: number; // 20-20000 Hz
  resonance: number; // 0-40
  enabled: boolean;
}

export interface ChannelState {
  id: string; // 'A' or 'B'
  gain: number; // 0-1
  filter: ChannelFilterConfig;
  muted: boolean;
  monitor: boolean; // Cue monitoring
}

// LOOP CONTROLS
export interface LoopState {
  enabled: boolean;
  startPosition: number; // in seconds
  endPosition: number; // in seconds
  length: number; // in beats (auto-calculated)
  isRolling: boolean; // Currently playing
  quantize: boolean; // Snap loop points to beat grid
}

export interface QuickLoop {
  length: 0.5 | 1 | 2 | 4 | 8 | 16; // in beats
  enabled: boolean;
}

// DECK (composite DJ state)
export interface DJDeck {
  id: string;
  name: string;
  trackId?: string;
  tempo: TempoControlState;
  crossfader: CrossfaderState;
  hotCues: HotCuesState;
  beatSync: BeatSyncConfig;
  beatGrid?: BeatGrid;
  channel: ChannelState;
  loop: LoopState;
  quickLoops: QuickLoop[];
  currentPosition: number; // in seconds
  duration: number; // in seconds
  isPlaying: boolean;
}

// DJ MASTER
export interface DJMasterState {
  masterBpm: number;
  crossfader: CrossfaderState;
  deckA: DJDeck;
  deckB: DJDeck;
  headphoneMonitor: {
    deck: 'A' | 'B' | 'both';
    volume: number; // 0-1
    mix: number; // -1 (A) to +1 (B), for both
  };
}

// PERFORMANCE MONITORING
export interface DJPerformanceMetrics {
  crossfaderLatency: number; // milliseconds
  tempoChangeLatency: number; // milliseconds
  loopAccuracy: number; // 0-1 (how accurately loop points snap to beats)
  beatSyncAccuracy: number; // 0-1
  cpuUsage: number; // 0-100 percent
  timestamp: number;
}

// API RESPONSES
export interface DJStateResponse {
  masterBpm: number;
  deckA: {
    tempo: TempoControlState;
    hotCues: HotCue[];
    currentPosition: number;
    isPlaying: boolean;
  };
  deckB: {
    tempo: TempoControlState;
    hotCues: HotCue[];
    currentPosition: number;
    isPlaying: boolean;
  };
  crossfader: CrossfaderState;
  metrics: DJPerformanceMetrics;
}

export interface LoopResponse {
  startPosition: number;
  endPosition: number;
  length: number;
  isActive: boolean;
}

// CONSTANTS
export const DJ_CONSTRAINTS = {
  MIN_BPM: 40,
  MAX_BPM: 240,
  MIN_PITCH_SHIFT: -50,
  MAX_PITCH_SHIFT: 50,
  PITCH_RANGE_SEMITONES: 50,
  MIN_FREQUENCY: 20,
  MAX_FREQUENCY: 20000,
  CROSSFADER_LATENCY_TARGET: 5, // milliseconds
  LOOP_SNAP_THRESHOLD: 50, // milliseconds
  HOT_CUES_PER_DECK: 8,
  BEAT_SYNC_GRID_RESOLUTION: 0.01, // 10ms resolution
} as const;

export const CUE_COLOR_MAP = CUE_COLORS;