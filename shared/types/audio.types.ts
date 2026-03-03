// shared/types/audio.types.ts

export type TransportState = {
  playing: boolean;
  recording: boolean;
  bpm: number;
  position: number; // seconds
};

export type TrackType = "audio" | "midi" | "instrument";

export type TrackConfig = {
  id: string;
  name: string;
  type: TrackType;
  volume: number; // linear gain
  pan: number; // -1 to 1
  muted: boolean;
  solo: boolean;
};

export type MeterData = {
  rms: number;
  peak: number;
};

export type AutomationPoint = {
  time: number;
  value: number;
};

export type AutomationLane = {
  paramId: string;
  points: AutomationPoint[];
};
