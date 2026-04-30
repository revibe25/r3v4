export interface DJControlsProps {
  filterVal: number;
  pitchSemitones: number;
  crossfade: number;
  onFilterChange: (value: number) => void;
  onPitchChange: (semitones: number) => void;
  onCrossfadeChange: (value: number) => void;
}

export interface KnobProps {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  testId: string;
  defaultValue?: number;
  step?: number;
}

export interface ChannelState {
  id: number;
  name: string;
  color: string;
  inputType: 'xlr' | 'line' | 'usb';
  gain: number;
  phantom: boolean;
  phase: boolean;
  lowCut: boolean;
  eqLow: number;
  eqLowMid: number;
  eqHighMid: number;
  eqHigh: number;
  eqLowFreq: number;
  eqHighFreq: number;
  compression: number;
  compThreshold: number;
  compAttack: number;
  compRelease: number;
  compKnee: number;
  noiseGate: boolean;
  gateThreshold: number;
  gateAttack: number;
  gateRelease: number;
  deEsser: boolean;
  deEsserFreq: number;
  limiter: boolean;
  limiterThreshold: number;
  pan: number;
  fader: number;
  mute: boolean;
  solo: boolean;
  reverb: number;
  delay: number;
  delayTime: number;
  chorus: number;
  auxSend1: number;
  auxSend2: number;
  level: number;
  peakLevel: number;
  recording: boolean;
}

export interface MasterState {
  mainFader: number;
  headphoneFader: number;
  monitoring: 'stereo' | 'mono' | 'left' | 'right';
  masterCompression: number;
  masterLimiter: boolean;
  recording: boolean;
  streamActive: boolean;
}
