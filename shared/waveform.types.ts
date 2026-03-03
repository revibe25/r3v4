// Shared waveform editor types for R3VIBE Native

// WAVEFORM DISPLAY
export interface WaveformConfig {
  pixelsPerSecond: number; // zoom level
  height: number; // canvas height
  width: number; // canvas width
  backgroundColor: string;
  waveformColor: string;
  progressColor: string;
  cursorColor: string;
}

export interface WaveformSelection {
  start: number; // in seconds
  end: number; // in seconds
  isActive: boolean;
}

export interface WaveformState {
  config: WaveformConfig;
  selection: WaveformSelection;
  playbackPosition: number; // in seconds
  zoom: number; // 0.1 to 10
  pan: number; // horizontal scroll offset in pixels
  showCursorTime: boolean;
  showRuler: boolean;
}

// AUDIO EDITING
export type EditType = 'trim' | 'fade' | 'normalize' | 'reverse' | 'timewarp' | 'pitchshift' | 'silence';

export interface TrimEdit {
  type: 'trim';
  startTime: number; // in seconds
  endTime: number; // in seconds
}

export interface FadeEdit {
  type: 'fade';
  direction: 'in' | 'out';
  duration: number; // in milliseconds
  curve: 'linear' | 'exponential' | 'logarithmic';
}

export interface NormalizeEdit {
  type: 'normalize';
  targetLevel: number; // 0-1
  analyzeSelection: boolean;
}

export interface ReverseEdit {
  type: 'reverse';
  startTime: number;
  endTime: number;
}

export interface TimeWarpEdit {
  type: 'timewarp';
  stretch: number; // 0.5 to 2.0 (50% to 200% speed)
  startTime: number;
  endTime: number;
  usePhaseVocoder: boolean; // Better quality
}

export interface PitchShiftEdit {
  type: 'pitchshift';
  semitones: number; // -12 to +12
  startTime: number;
  endTime: number;
  preserveFormants: boolean;
}

export interface SilenceEdit {
  type: 'silence';
  startTime: number;
  endTime: number;
}

export type AnyEdit = 
  | TrimEdit 
  | FadeEdit 
  | NormalizeEdit 
  | ReverseEdit 
  | TimeWarpEdit 
  | PitchShiftEdit 
  | SilenceEdit;

// SAMPLE SLICING
export interface SlicePoint {
  id: string;
  position: number; // in seconds
  label?: string;
  locked: boolean; // Can't be moved
  beatAligned: boolean; // Snapped to beat grid
}

export interface Slice {
  id: string;
  startPosition: number;
  endPosition: number;
  label: string;
  tempo?: number; // BPM if detected
}

export interface SliceConfig {
  points: SlicePoint[];
  slices: Slice[];
  sensitivity: number; // 0-1 (for auto-detection)
  minSliceLength: number; // in milliseconds
  useTransients: boolean; // Detect transient peaks
  beatGridBased: boolean; // Slice at beat boundaries
}

// HISTORY & UNDO
export interface EditHistoryEntry {
  id: string;
  type: EditType;
  edit: AnyEdit;
  timestamp: number;
  description: string;
  canUndo: boolean;
  canRedo: boolean;
}

export interface EditHistory {
  entries: EditHistoryEntry[];
  currentIndex: number; // Pointer to current state
  maxEntries: number; // Limit for memory
}

// SAMPLE METADATA
export interface SampleMetadata {
  id: string;
  filename: string;
  originalBpm?: number; // Detected BPM
  originalPitch?: string; // Musical note
  duration: number; // in seconds
  sampleRate: number; // Hz
  channels: 1 | 2; // Mono or Stereo
  bitDepth: 16 | 24 | 32;
  detectedKey?: string; // e.g., 'C minor'
  tags: string[];
  createdAt: Date;
  modifiedAt: Date;
}

export interface WaveformData {
  channels: Float32Array[]; // One array per channel
  sampleRate: number;
  duration: number;
  peaks?: {
    // Downsampled peaks for fast rendering
    min: Float32Array;
    max: Float32Array;
    resolution: number; // samples per peak
  };
}

// BATCH OPERATIONS
export interface BatchEditOperation {
  id: string;
  name: string;
  edits: AnyEdit[];
  selection: WaveformSelection;
  parallel: boolean; // Execute in parallel
}

export interface BatchResult {
  operationId: string;
  success: boolean;
  duration: number; // milliseconds
  samplesProcessed: number;
  errors?: string[];
}

// ANALYSIS & DETECTION
export interface AudioAnalysis {
  duration: number;
  rms: number; // Root Mean Square
  peakLevel: number; // 0-1
  crestFactor: number;
  spectralCentroid: number; // Hz
  zeroCrossingRate: number;
  detectedBpm?: number;
  detectedKey?: string;
  transients: number[]; // Timestamps of detected transients
  silence: Array<{ start: number; end: number }>;
}

export interface TransientDetection {
  position: number; // in seconds
  strength: number; // 0-1
  type: 'onset' | 'peak' | 'edge';
}

// PERFORMANCE METRICS
export interface WaveformEditorMetrics {
  renderTime: number; // milliseconds
  editApplyTime: number; // milliseconds
  historySize: number; // number of entries
  memoryUsage: number; // MB
  peakMemory: number; // MB
}

// API RESPONSES
export interface SampleEditResponse {
  sampleId: string;
  edits: Array<{
    type: EditType;
    appliedAt: number; // timestamp
    duration?: number;
  }>;
  success: boolean;
  newDuration: number;
  newPeakLevel: number;
}

export interface SliceResponse {
  sampleId: string;
  slices: Array<{
    id: string;
    label: string;
    startTime: number;
    endTime: number;
    duration: number;
  }>;
  count: number;
}

export interface AnalysisResponse {
  sampleId: string;
  analysis: AudioAnalysis;
  transients: TransientDetection[];
  processedAt: number;
}

// CONSTANTS
export const WAVEFORM_DEFAULTS = {
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 10,
  DEFAULT_ZOOM: 1,
  PIXEL_DENSITY: 2, // for retina displays
  BUFFER_SIZE: 2048,
  FADE_MIN_DURATION: 10, // milliseconds
  FADE_MAX_DURATION: 5000,
  PITCH_SHIFT_RANGE: 12, // semitones
  TIME_WARP_MIN: 0.5,
  TIME_WARP_MAX: 2.0,
  RENDER_TARGET_TIME: 500, // milliseconds for 5 min file
  SLICE_MIN_LENGTH: 50, // milliseconds
} as const;

export const EDIT_DESCRIPTIONS: Record<EditType, string> = {
  trim: 'Trim sample to selection',
  fade: 'Apply fade in/out',
  normalize: 'Normalize audio level',
  reverse: 'Reverse audio',
  timewarp: 'Change playback speed',
  pitchshift: 'Shift pitch',
  silence: 'Silence selection',
};