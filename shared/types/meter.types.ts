export interface MeterData {
  peakLeft: number;
  peakRight: number;
  rmsLeft: number;
  rmsRight: number;
  timestamp: number;
}

export interface MeterState {
  meters: Record<string, MeterData>;
}
