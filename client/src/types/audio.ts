// client/src/types/audio.ts

/**
 * Audio System Type Definitions
 * 
 * Centralized type definitions for the audio engine, VST system,
 * mixer, effects, and automation.
 * 
 * @module types/audio
 */

// ============================================
// CORE AUDIO TYPES
// ============================================

/**
 * Audio context wrapper with additional metadata
 */
export interface AudioContextInfo {
  context: AudioContext;
  sampleRate: number;
  baseLatency: number;
  outputLatency: number;
  state: AudioContextState;
}

/**
 * Audio buffer metadata
 */
export interface AudioBufferInfo {
  buffer: AudioBuffer;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
}

/**
 * Audio node connection configuration
 */
export interface AudioNodeConnection {
  source: AudioNode;
  destination: AudioNode;
  outputIndex?: number;
  inputIndex?: number;
}

// ============================================
// VST & EFFECTS TYPES
// ============================================

/**
 * Base effect/plugin interface
 */
export interface AudioEffect {
  id: string;
  name: string;
  type: EffectType;
  enabled: boolean;
  bypassed: boolean;
  wet: number; // 0-1 dry/wet mix
  input: AudioNode;
  output: AudioNode;
  
  // Lifecycle methods
  connect(destination: AudioNode): void;
  disconnect(): void;
  dispose(): void;
  
  // State management
  getState(): EffectState;
  setState(state: EffectState): void;
  
  // Parameter control
  getParameters(): EffectParameter[];
  setParameter(id: string, value: number): void;
  getParameter(id: string): number | undefined;
}

/**
 * Effect types supported by the system
 */
export enum EffectType {
  COMPRESSOR = 'compressor',
  EQ = 'eq',
  REVERB = 'reverb',
  DELAY = 'delay',
  DISTORTION = 'distortion',
  CHORUS = 'chorus',
  FLANGER = 'flanger',
  PHASER = 'phaser',
  FILTER = 'filter',
  LIMITER = 'limiter',
  GATE = 'gate',
  CUSTOM = 'custom',
}

/**
 * Effect parameter definition
 */
export interface EffectParameter {
  id: string;
  name: string;
  type: ParameterType;
  value: number;
  min: number;
  max: number;
  default: number;
  unit?: string;
  step?: number;
  automatable?: boolean;
}

/**
 * Parameter value types
 */
export enum ParameterType {
  FLOAT = 'float',
  INT = 'int',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
}

/**
 * Serializable effect state
 */
export interface EffectState {
  id: string;
  type: EffectType;
  enabled: boolean;
  bypassed: boolean;
  wet: number;
  parameters: Record<string, number>;
  metadata?: Record<string, any>;
}

/**
 * Effect chain - ordered collection of effects
 */
export interface EffectChain {
  id: string;
  channelId: string;
  effects: AudioEffect[];
  
  // Chain operations
  addEffect(effect: AudioEffect, position?: number): void;
  removeEffect(effectId: string): void;
  reorderEffect(effectId: string, newPosition: number): void;
  getEffect(effectId: string): AudioEffect | undefined;
  
  // Bulk operations
  bypassAll(): void;
  enableAll(): void;
  clear(): void;
  
  // State management
  serialize(): EffectChainState;
  deserialize(state: EffectChainState): void;
  
  // Cleanup
  dispose(): void;
}

/**
 * Serializable effect chain state
 */
export interface EffectChainState {
  id: string;
  channelId: string;
  effects: EffectState[];
  timestamp: number;
}

// ============================================
// MIXER TYPES
// ============================================

/**
 * Mixer channel configuration
 */
export interface MixerChannelConfig {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  solo?: boolean;
  mute?: boolean;
  volume?: number; // 0-1
  pan?: number; // -1 (left) to 1 (right)
  monitored?: boolean;
}

// MixerChannel: use class from @/audio/mixer/mixer-channel

/**
 * Master mixer bus
 */
export interface MasterBus {
  id: 'master';
  
  // Audio nodes
  input: GainNode;
  output: GainNode;
  limiter: DynamicsCompressorNode;
  
  // State
  volume: number;
  
  // VU meter
  vuLevel: number;
  peakLevel: number;
  
  // Methods
  setVolume(value: number): void;
  connect(destination: AudioNode): void;
  disconnect(): void;
  dispose(): void;
}

// ============================================
// SIDECHAIN TYPES
// ============================================

/**
 * Sidechain connection configuration
 */
export interface SidechainConfig {
  id: string;
  sourceChannelId: string;
  targetChannelId: string;
  targetEffectId: string;
  enabled: boolean;
  amount: number; // 0-1 sidechain intensity
  attack?: number;
  release?: number;
  threshold?: number;
  targetVSTId: string;
  gainCompensation: number;
  sidechainInput?: string;
}

/**
 * Active sidechain connection
 */
export interface SidechainConnection {
  id: string;
  config: SidechainConfig;
  sourceNode: AudioNode;
  targetNode: AudioNode;
  analyserNode: AnalyserNode;
  
  // Methods
  enable(): void;
  disable(): void;
  setAmount(amount: number): void;
  disconnect(): void;
  dispose(): void;
}

// SidechainRouter: use class from @/audio/fx/vst-sidechain

/**
 * Serializable sidechain router state
 */
export interface SidechainRouterState {
  connections: SidechainConfig[];
  timestamp: number;
}

// ============================================
// AUTOMATION TYPES
// ============================================

/**
 * Automation target (parameter to automate)
 */
export interface AutomationTarget {
  channelId: string;
  effectId?: string;
  parameterId: string;
  parameterName: string;
  min: number;
  max: number;
  unit?: string;
}

/**
 * Single automation point
 */
export interface AutomationPoint {
  time: number; // in seconds or beats
  value: number;
  curve?: AutomationCurve;
}

/**
 * Automation curve types
 */
export enum AutomationCurve {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  LOGARITHMIC = 'logarithmic',
  STEP = 'step',
  SMOOTH = 'smooth',
}

/**
 * Automation lane (single parameter automation)
 */
export interface AutomationLane {
  id: string;
  target: AutomationTarget;
  points: AutomationPoint[];
  enabled: boolean;
  
  // Point operations
  addPoint(point: AutomationPoint): void;
  removePoint(time: number): void;
  updatePoint(time: number, value: number): void;
  getPointAt(time: number): AutomationPoint | undefined;
  
  // Playback
  getValue(time: number): number;
  
  // State
  clear(): void;
  serialize(): AutomationLaneState;
}

/**
 * Serializable automation lane state
 */
export interface AutomationLaneState {
  id: string;
  target: AutomationTarget;
  points: AutomationPoint[];
  enabled: boolean;
}

/**
 * Automation engine - manages all automation
 */
export interface AutomationEngine {
  audioContext: AudioContext;
  lanes: Map<string, AutomationLane>;
  isPlaying: boolean;
  currentTime: number;
  
  // Lane management
  createLane(id: string, paramPath: string): AutomationLane;
  removeLane(laneId: string): void;
  getLane(laneId: string): AutomationLane | undefined;
  getAllLanes(): AutomationLane[];
  
  // Playback control
  play(): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  
  // Recording
  startRecording(laneId: string): void;
  stopRecording(): void;
  isRecording: boolean;
  
  // State management
  serialize(): AutomationEngineState;
  deserialize(state: AutomationEngineState): void;
  
  // Cleanup
  dispose(): void;
}

/**
 * Serializable automation engine state
 */
export interface AutomationEngineState {
  lanes: AutomationLaneState[];
  timestamp: number;
}

// ============================================
// PERFORMANCE MONITORING TYPES
// ============================================

/**
 * CPU usage metrics
 */
export interface CPUMetrics {
  total: number; // 0-100 percentage
  audioThread: number;
  uiThread: number;
  timestamp: number;
}

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  used: number; // in MB
  total: number;
  percentage: number;
  audioBuffers: number;
  timestamp: number;
}

/**
 * Latency metrics
 */
export interface LatencyMetrics {
  input: number; // in ms
  output: number;
  total: number;
  bufferSize: number;
  timestamp: number;
}

/**
 * Per-effect performance data
 */
export interface EffectPerformance {
  effectId: string;
  effectType: EffectType;
  cpuUsage: number;
  processingTime: number; // in ms
  dropouts: number;
  timestamp: number;
}

/**
 * Per-channel performance data
 */
export interface ChannelPerformance {
  channelId: string;
  cpuUsage: number;
  effectsCount: number;
  effects: EffectPerformance[];
  timestamp: number;
}

/**
 * System-wide performance snapshot
 */
export interface PerformanceSnapshot {
  timestamp: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  latency: LatencyMetrics;
  channels: ChannelPerformance[];
  totalEffects: number;
  totalDropouts: number;
  sampleRate: number;
  bufferSize: number;
}

/**
 * Performance monitor - tracks system performance
 */
export interface PerformanceMonitor {
  audioContext: AudioContext;
  isMonitoring: boolean;
  
  // Monitoring control
  start(): void;
  stop(): void;
  
  // Data retrieval
  getCurrentSnapshot(): PerformanceSnapshot;
  getHistory(duration?: number): PerformanceSnapshot[];
  
  // Effect tracking
  trackEffect(effectId: string, effectType: EffectType): void;
  untrackEffect(effectId: string): void;
  getEffectPerformance(effectId: string): EffectPerformance | undefined;
  
  // Channel tracking
  trackChannel(channelId: string): void;
  untrackChannel(channelId: string): void;
  getChannelPerformance(channelId: string): ChannelPerformance | undefined;
  
  // Alerts
  onCPUOverload?: (usage: number) => void;
  onMemoryWarning?: (usage: number) => void;
  onDropout?: (channelId: string, effectId: string) => void;
  
  // Cleanup
  dispose(): void;
}

// ============================================
// PROJECT/SESSION TYPES
// ============================================

/**
 * Complete project state
 */
export interface ProjectState {
  version: string;
  timestamp: number;
  metadata: ProjectMetadata;
  
  // Audio configuration
  sampleRate: number;
  bufferSize: number;
  
  // Mixer state
  channels: MixerChannelState[];
  masterBus: MasterBusState;
  
  // Effects
  effectChains: EffectChainState[];
  
  // Routing
  sidechains: SidechainRouterState;
  
  // Automation
  automation: AutomationEngineState;
  
  // Performance settings
  performanceSettings?: PerformanceSettings;
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  name: string;
  author?: string;
  description?: string;
  created: number;
  modified: number;
  tags?: string[];
  bpm?: number;
  timeSignature?: string;
}

/**
 * Serializable mixer channel state
 */
export interface MixerChannelState {
  id: string;
  name: string;
  volume: number;
  pan: number;
  solo: boolean;
  mute: boolean;
  color?: string;
  icon?: string;
}

/**
 * Serializable master bus state
 */
export interface MasterBusState {
  volume: number;
  limiterEnabled: boolean;
  limiterThreshold?: number;
}

/**
 * Performance optimization settings
 */
export interface PerformanceSettings {
  maxCPUUsage: number; // 0-100
  maxEffectsPerChannel: number;
  enableAutoBypass: boolean;
  enableAdaptiveBuffering: boolean;
  priorityChannels?: string[];
}

// ============================================
// MIDI TYPES
// ============================================

/**
 * MIDI note event
 */
export interface MIDINoteEvent {
  type: 'noteOn' | 'noteOff';
  note: number; // 0-127
  velocity: number; // 0-127
  channel: number; // 0-15
  timestamp: number;
}

/**
 * MIDI control change event
 */
export interface MIDIControlEvent {
  type: 'controlChange';
  controller: number; // 0-127
  value: number; // 0-127
  channel: number; // 0-15
  timestamp: number;
}

/**
 * MIDI message union type
 */
export type MIDIMessage = MIDINoteEvent | MIDIControlEvent;

/**
 * MIDI parameter mapping
 */
export interface MIDIMapping {
  id: string;
  midiController: number;
  midiChannel: number;
  target: AutomationTarget;
  min?: number;
  max?: number;
  curve?: AutomationCurve;
}

// ============================================
// TRANSPORT TYPES
// ============================================

/**
 * Transport state
 */
export enum TransportState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused',
  RECORDING = 'recording',
}

/**
 * Transport position
 */
export interface TransportPosition {
  seconds: number;
  beats: number;
  bars: number;
  bpm: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
}

/**
 * Transport control interface
 */
export interface Transport {
  state: TransportState;
  position: TransportPosition;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  
  // Playback control
  play(): void;
  pause(): void;
  stop(): void;
  record(): void;
  
  // Position control
  seek(position: number): void;
  seekBars(bars: number): void;
  
  // Loop control
  setLoop(enabled: boolean): void;
  setLoopRegion(start: number, end: number): void;
  
  // Tempo control
  setBPM(bpm: number): void;
  setTimeSignature(numerator: number, denominator: number): void;
  
  // Events
  onPositionChange?: (position: TransportPosition) => void;
  onStateChange?: (state: TransportState) => void;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Audio file metadata
 */
export interface AudioFileMetadata {
  name: string;
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth?: number;
  format: string;
  size: number;
}

/**
 * Audio waveform data for visualization
 */
export interface WaveformData {
  peaks: Float32Array;
  length: number;
  sampleRate: number;
  duration: number;
}

/**
 * Frequency spectrum data for visualization
 */
export interface SpectrumData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  binCount: number;
  sampleRate: number;
  timestamp: number;
}

/**
 * Generic disposable resource
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Generic serializable object
 */
export interface Serializable<T = any> {
  serialize(): T;
  deserialize(data: T): void;
}

// ============================================
// RE-EXPORTS FROM ACTUAL IMPLEMENTATIONS
// ============================================

// Re-export actual implementations when they match interfaces
export type { VSTPerformanceMonitor } from '@/audio/fx/vst-performance-monitor';
export type { VSTAutomationEngine } from '@/audio/fx/vst-automation-engine';

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type guard for MIDI note events
 */
export function isMIDINoteEvent(msg: MIDIMessage): msg is MIDINoteEvent {
  return msg.type === 'noteOn' || msg.type === 'noteOff';
}

/**
 * Type guard for MIDI control events
 */
export function isMIDIControlEvent(msg: MIDIMessage): msg is MIDIControlEvent {
  return msg.type === 'controlChange';
}

/**
 * Type guard for AudioEffect
 */
export function isAudioEffect(obj: any): obj is AudioEffect {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.connect === 'function' &&
    typeof obj.disconnect === 'function' &&
    typeof obj.dispose === 'function'
  );
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Default buffer sizes (power of 2)
 */
export const BUFFER_SIZES = [128, 256, 512, 1024, 2048, 4096, 8192] as const;

/**
 * Standard sample rates
 */
export const SAMPLE_RATES = [44100, 48000, 88200, 96000, 176400, 192000] as const;

/**
 * Default performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  CPU_WARNING: 70,
  CPU_CRITICAL: 85,
  MEMORY_WARNING: 75,
  MEMORY_CRITICAL: 90,
  MAX_LATENCY: 50, // ms
} as const;

/**
 * MIDI note names
 */
export const MIDI_NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
] as const;

/**
 * Project version for compatibility checking
 */
export const PROJECT_VERSION = '1.0.0' as const;
export interface DelayParams {
  delayTime: number;
  feedback: number;
  mix: number;
  wet: number;
  dry: number;
}

export interface DistortionParams {
  drive: number;
  wet: number;
  dry: number;
}

export interface EQParams {
  lowFreq: number;
  midFreq: number;
  highFreq: number;
  lowGain: number;
  midGain: number;
  highGain: number;
  wet: number;
  dry: number;
}

export interface FilterParams {
  rolloff: number;
  frequency: number;
  Q: number;
  wet: number;
  dry: number;
}

export interface ReverbParams {
  decay: number;
  preDelay: number;
  wet: number;
  dry: number;
}

export interface AutomationLaneData {
  paramPath: string;
}

