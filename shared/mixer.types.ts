/**
 * R3VIBE Native - Mixer System Type Definitions
 * 
 * @module mixer.types
 * @category Type Definitions
 * 
 * Defines all types for the mixer system including:
 * - Mixer channels (pads, instruments, tracks, DJ decks)
 * - Master bus
 * - Solo/Mute management
 * - Send/Return routing
 * - Metering and gain staging
 */

import type { 
  AudioChannelType, 
  GainState, 
  PanState, 
  MeterData,
  AudioRouting 
} from './audio.types';

// ==========================================
// MIXER CHANNEL TYPES
// ==========================================

export type MixerChannelStatus = 
  | 'idle'          // No audio loaded or playing
  | 'armed'         // Armed for recording
  | 'playing'       // Actively playing audio
  | 'recording'     // Currently recording
  | 'muted'         // Muted by user
  | 'soloed';       // Solo mode active

export type FaderMode = 
  | 'pre-fader'     // Signal taken before fader
  | 'post-fader';   // Signal taken after fader (default)

// ==========================================
// MIXER CHANNEL CONFIGURATION
// ==========================================

export interface MixerChannelConfig {
  id: string;
  name: string;
  type: AudioChannelType;
  color?: string;               // UI color coding
  index: number;                // Channel strip position
  groupId?: string;             // Optional channel grouping
}

// ==========================================
// MIXER CHANNEL STATE
// ==========================================

export interface MixerChannelState {
  config: MixerChannelConfig;
  
  // Gain & Panning
  gain: GainState;
  pan: PanState;
  
  // Mute/Solo
  isMuted: boolean;
  isSoloed: boolean;
  isSoloSafe: boolean;          // Immune to solo operations
  
  // Signal State
  state: MixerChannelStatus;
  isActive: boolean;            // Currently processing audio
  
  // Metering
  meter: MeterData;
  
  // Fader Mode
  faderMode: FaderMode;
  
  // FX Chain
  fxChainId?: string;           // Reference to FX chain
  
  // Send Routing
  sends: SendState[];
  
  // Metadata
  lastActivity: number;         // Timestamp of last audio activity
}

// ==========================================
// SEND/RETURN SYSTEM
// ==========================================

export interface SendState {
  id: string;
  destinationBusId: string;
  level: number;                // 0.0 to 1.0
  preFader: boolean;
  isActive: boolean;
}

export interface ReturnChannelConfig {
  id: string;
  name: string;
  inputBusId: string;
}

// ==========================================
// MASTER BUS
// ==========================================

export interface MasterBusState {
  id: 'master';
  name: 'Master';
  
  // Gain
  gain: GainState;
  
  // Limiting
  limiterEnabled: boolean;
  limiterThreshold: number;     // dB
  
  // Metering
  meter: MeterData;
  peakMeter: MeterData;
  
  // Master FX Chain
  fxChainId?: string;
  
  // Clipping Detection
  isClipping: boolean;
  clipCount: number;
}

// ==========================================
// SOLO MANAGEMENT
// ==========================================

export interface SoloState {
  hasSoloedChannels: boolean;
  soloedChannelIds: string[];
  soloMode: SoloMode;
}

export type SoloMode = 
  | 'solo-in-place'             // Mute non-soloed channels
  | 'solo-pfl';                 // Pre-fader listen (monitor only)

// ==========================================
// MIXER ROUTING
// ==========================================

export interface MixerRouting {
  channels: MixerChannelRouting[];
  buses: BusRouting[];
  masterBus: MasterBusRouting;
}

export interface MixerChannelRouting {
  channelId: string;
  inputSource?: string;         // Audio source node ID
  outputDestination: string;    // Usually master bus
  sends: AudioRouting[];
  fxChainId?: string;
}

export interface BusRouting {
  busId: string;
  inputs: string[];             // Input channel IDs
  output: string;               // Output destination
}

export interface MasterBusRouting {
  inputs: string[];             // All channel outputs
  output: 'destination';        // AudioContext.destination
}

// ==========================================
// MIXER SNAPSHOT (STATE PERSISTENCE)
// ==========================================

export interface MixerSnapshot {
  version: string;
  timestamp: number;
  channels: Record<string, MixerChannelState>;
  masterBus: MasterBusState;
  soloState: SoloState;
  routing: MixerRouting;
}

// ==========================================
// GAIN STAGING HELPERS
// ==========================================

export interface GainStagingConfig {
  nominalLevel: number;         // -18 dBFS (default for DAW)
  headroom: number;             // 6 dB (default)
  unityGainDb: number;          // 0 dB
  minGainDb: number;            // -Infinity or -60 dB
  maxGainDb: number;            // +6 dB
}

export const DEFAULT_GAIN_STAGING: GainStagingConfig = {
  nominalLevel: -18,
  headroom: 6,
  unityGainDb: 0,
  minGainDb: -60,
  maxGainDb: 6,
};

// ==========================================
// MIXER EVENTS
// ==========================================

export type MixerEventType =
  | 'channel-added'
  | 'channel-removed'
  | 'channel-muted'
  | 'channel-unmuted'
  | 'channel-soloed'
  | 'channel-unsoloed'
  | 'gain-changed'
  | 'pan-changed'
  | 'send-changed'
  | 'master-gain-changed'
  | 'clipping-detected'
  | 'solo-state-changed';

export interface MixerEvent {
  type: MixerEventType;
  timestamp: number;
  channelId?: string;
  data?: Record<string, unknown>;
}

// ==========================================
// MIXER PERFORMANCE METRICS
// ==========================================

export interface MixerPerformanceMetrics {
  activeChannels: number;
  mutedChannels: number;
  soloedChannels: number;
  totalChannels: number;
  cpuUsagePercent: number;
  meterUpdateRate: number;      // Hz
  lastUpdateTime: number;
}

// ==========================================
// MIXER AUTOMATION DATA
// ==========================================

export interface MixerAutomationData {
  channelId: string;
  parameter: 'gain' | 'pan' | 'send-level';
  points: AutomationPoint[];
}

export interface AutomationPoint {
  time: number;                 // Seconds
  value: number;
  curve?: 'linear' | 'exponential';
}

// ==========================================
// UTILITY TYPES
// ==========================================

export type ChannelStripSection = 
  | 'input-gain'
  | 'fx-inserts'
  | 'eq'
  | 'dynamics'
  | 'sends'
  | 'pan'
  | 'fader'
  | 'meter';

export interface ChannelStripLayout {
  sections: ChannelStripSection[];
  collapsedSections: ChannelStripSection[];
}

// ==========================================
// CONSTANTS
// ==========================================

export const MIXER_CONSTANTS = {
  MAX_CHANNELS: 128,
  MAX_SENDS: 8,
  MAX_BUSES: 16,
  DEFAULT_FADER_DB: 0,
  DEFAULT_PAN: 0,
  METER_DECAY_RATE: 20,         // dB per second
  CLIP_THRESHOLD: -0.1,         // dBFS
  CLIP_HOLD_TIME: 2000,         // ms
} as const;

// ==========================================
// TYPE GUARDS
// ==========================================

export function isMixerChannelState(obj: unknown): obj is MixerChannelState {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'config' in obj &&
    'gain' in obj &&
    'pan' in obj &&
    'isMuted' in obj &&
    'isSoloed' in obj
  );
}

export function isMasterBusState(obj: unknown): obj is MasterBusState {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    (obj as Record<string, unknown>).id === 'master' &&
    'gain' in obj &&
    'meter' in obj
  );
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Create default mixer channel state
 */
export function createDefaultChannelState(
  config: MixerChannelConfig
): MixerChannelState {
  return {
    config,
    gain: {
      linear: 1.0,
      decibels: 0,
    },
    pan: {
      position: 0,
      law: 'equal-power',
    },
    isMuted: false,
    isSoloed: false,
    isSoloSafe: false,
    state: 'idle',
    isActive: false,
    meter: {
      peak: -Infinity,
      rms: -Infinity,
      timestamp: Date.now(),
    },
    faderMode: 'post-fader',
    sends: [],
    lastActivity: 0,
  };
}

/**
 * Create default master bus state
 */
export function createDefaultMasterBusState(): MasterBusState {
  return {
    id: 'master',
    name: 'Master',
    gain: {
      linear: 1.0,
      decibels: 0,
    },
    limiterEnabled: true,
    limiterThreshold: -0.3,
    meter: {
      peak: -Infinity,
      rms: -Infinity,
      timestamp: Date.now(),
    },
    peakMeter: {
      peak: -Infinity,
      rms: -Infinity,
      timestamp: Date.now(),
    },
    isClipping: false,
    clipCount: 0,
  };
}

export {};
