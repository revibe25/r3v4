// shared/types/meter.types.ts — auto-generated stub
export interface MeterOptions {
  channels?: number;
  smoothing?: number;
  normalRange?: boolean;
  clipLevel?: number;
  attackTime?: number;
  releaseTime?: number;
}
export type MeterValue = number | number[];
export interface MeterLevel {
  peak: number;
  rms: number;
  clip: boolean;
}

export interface MeterData {
  peak: number;
  rms: number;
  clipping: boolean;
  time: number;
}
