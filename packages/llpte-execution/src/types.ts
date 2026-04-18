export type CrossfadeCurve = 'linear' | 'equal-power' | 'logarithmic' | 's-curve';

export interface CrossfadeParams {
  durationMs:   number;
  curveType:    CrossfadeCurve;
  startGainA:   number;  // 0.0–1.0
  endGainA:     number;  // 0.0–1.0
  startGainB:   number;  // 0.0–1.0
  endGainB:     number;  // 0.0–1.0
}

export interface ExecutionResult {
  success:              boolean;
  scheduledAtAudioTime: number;
  actualLatencyMs:      number;  // target < 10ms
  error?:               string;
}

export interface BufferSchedule {
  trackId:       string;
  startOffset:   number;
  scheduledTime: number;
  priority:      'critical' | 'high' | 'normal';
}
