// types.ts - Centralized type definitions for the multi-track DAW

export type TrackType = 'audio' | 'midi' | 'aux' | 'master';
export type FXType = 'EQ' | 'Compressor' | 'Reverb' | 'Delay' | 'Limiter' | 'Saturation' | 'Gate' | 'DeEsser' | 'VST';
export type MixerView = 'narrow' | 'medium' | 'wide' | 'extended';
export type TimeFormat = 'bars' | 'seconds' | 'samples' | 'smpte';
export type ViewMode = 'mixer' | 'timeline' | 'split';
export type AutomationMode = 'off' | 'read' | 'write' | 'touch' | 'latch';

export interface AudioClip {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  audioBuffer?: AudioBuffer;
  fileName: string;
  waveformData?: number[];
  color: string;
}

export interface AutomationPoint {
  time: number;
  value: number;
}

export interface TrackAutomation {
  volume: AutomationPoint[];
  pan: AutomationPoint[];
  [key: string]: AutomationPoint[];
}

export interface AdvancedTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  armed: boolean;
  muted: boolean;
  solo: boolean;
  frozen: boolean;
  volume: number;
  pan: number;
  fxChain: FXType[];
  clips: AudioClip[];
  automation: TrackAutomation;
  automationMode: AutomationMode;
  meter: number;
  peak: number;
  input: string;
  output: string;
  cpuUsage: number;
}

export interface TransportState {
  isPlaying: boolean;
  isRecording: boolean;
  position: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  tempo: number;
  timeSignature: string;
}

export interface Preferences {
  theme: 'dark' | 'light';
  mixerView: MixerView;
  timeFormat: TimeFormat;
  viewMode: ViewMode;
  autoSave: boolean;
  bufferSize: number;
  sampleRate: number;
  showCpuMeter: boolean;
  showVSTPanel: boolean;
}

export interface ProjectState {
  title: string;
  tracks: AdvancedTrack[];
  transport: TransportState;
  masterVolume: number;
  masterMeter: number;
  masterPeak: number;
  cpuUsage: number;
}

export interface MixerViewProps {
  tracks: AdvancedTrack[];
  masterVolume: number;
  masterMeter: number;
  masterPeak: number;
  preferences: Preferences;
  onUpdateTrack: (trackId: string, updates: Partial<AdvancedTrack>) => void;
  onUpdateMaster: (volume: number) => void;
  onShowVSTPanel: (trackId: string) => void;
}

export interface TimelineViewProps {
  tracks: AdvancedTrack[];
  transport: TransportState;
  zoom: number;
  onClipMove: (clipId: string, time: number) => void;
  onAddClip: (trackId: string, file: File) => void;
}

export interface WaveformDisplayProps {
  waveformData: number[];
  color: string;
  height: number;
}

export interface AdvancedMeterProps {
  level: number;
  peak: number;
  height: number;
}

export interface PreferencesModalProps {
  preferences: Preferences;
  onUpdate: (updates: Partial<Preferences>) => void;
  onClose: () => void;
}

export interface VSTPanelModalProps {
  trackId: string;
  onClose: () => void;
}