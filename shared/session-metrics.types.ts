export interface SessionStartInput {
  trackIds: string[];
  bpm: number;
}

export interface SessionStopInput {
  sessionId: string;
}

export interface SessionMetricsSummary {
  sessionId: string;
  durationSeconds: number;
  timeSavedSeconds: number;
  peakEnergyScore: number;
  mixQualityScore: number;
  bpm: number;
  startedAt: string;
  endedAt: string | null;
}

export interface TimeSavingsBreakdown {
  totalSavedSeconds: number;
  byCategory: {
    autoGain: number;
    beatDetection: number;
    fxRouting: number;
  };
}

// Alias — production SessionSummaryPanel imports this name
export type TimeSavedBreakdown = TimeSavingsBreakdown;
