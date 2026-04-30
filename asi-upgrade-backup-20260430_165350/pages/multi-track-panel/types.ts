/**
 * pages/multi-track-panel/types.ts
 * Shared TypeScript interfaces for MultiTrackPanel.
 * The parent component has @ts-nocheck so these are for resolution only,
 * but they are correct and complete for future type-safe migration.
 */

export type FXType =
  | 'EQ' | 'Compressor' | 'Reverb' | 'Delay'
  | 'Saturation' | 'Limiter' | 'Filter' | 'Chorus'
  | 'Phaser' | 'Distortion';

export type ViewMode = 'mixer' | 'timeline' | 'split';

export type AutomationMode = 'off' | 'read' | 'write' | 'touch' | 'latch';

export interface AudioClip {
  id:           string;
  trackId:      string;
  startTime:    number;
  duration:     number;
  audioBuffer?: AudioBuffer;
  fileName:     string;
  waveformData?: number[];
  color:        string;
}

export interface AdvancedTrack {
  id:             string;
  name:           string;
  type:           'audio' | 'midi' | 'aux' | 'master';
  color:          string;
  armed:          boolean;
  muted:          boolean;
  solo:           boolean;
  frozen:         boolean;
  volume:         number;
  pan:            number;
  fxChain:        FXType[];
  clips:          AudioClip[];
  automation:     { volume: number[]; pan: number[] };
  automationMode: AutomationMode;
  meter:          number;
  peak:           number;
  input:          string;
  output:         string;
  cpuUsage:       number;
}

export interface TransportState {
  isPlaying:     boolean;
  isRecording:   boolean;
  position:      number;
  loopEnabled:   boolean;
  loopStart:     number;
  loopEnd:       number;
  tempo:         number;
  timeSignature: string;
}

export interface Preferences {
  theme:        string;
  mixerView:    string;
  timeFormat:   string;
  viewMode:     ViewMode;
  autoSave:     boolean;
  bufferSize:   number;
  sampleRate:   number;
  showCpuMeter: boolean;
  showVSTPanel: boolean;
}

export interface ProjectState {
  title:        string;
  tracks:       AdvancedTrack[];
  transport:    TransportState;
  masterVolume: number;
  masterMeter:  number;
  masterPeak:   number;
  cpuUsage:     number;
}
