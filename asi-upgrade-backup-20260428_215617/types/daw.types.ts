export type ClipType = 'audio' | 'midi';

export interface Clip {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  name?: string;
  type?: ClipType;
  color?: string;
}

export interface Track {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

export interface FXUnit {
  id: string;
  type: 'EQ' | 'Compressor' | 'Delay' | 'Reverb' | 'Distortion';
  bypassed: boolean;
}
