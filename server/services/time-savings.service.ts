import type { TimeSavingsBreakdown } from "../../shared/session-metrics.types";

/**
 * Estimates time saved by R3 automation features per session.
 * Formula is based on average manual workflow benchmarks (PRD §6.2).
 */
export function calculateTimeSavings(params: {
  durationSeconds: number;
  trackCount: number;
  bpm: number;
}): TimeSavingsBreakdown {
  const { durationSeconds, trackCount, bpm } = params;

  if (durationSeconds <= 0 || trackCount <= 0) {
    return {
      totalSavedSeconds: 0,
      byCategory: { autoGain: 0, beatDetection: 0, fxRouting: 0 },
    };
  }

  // Auto-gain: ~4s per track saved vs manual gain staging
  const autoGain = trackCount * 4;

  // Beat detection: scales with tempo complexity (±10 bpm from 128 = more work)
  const bpmDelta = Math.abs(bpm - 128);
  const beatDetection = Math.min(30, 10 + Math.floor(bpmDelta / 10) * 2);

  // FX routing: 3% of session duration up to 60s
  const fxRouting = Math.min(60, Math.floor(durationSeconds * 0.03));

  const totalSavedSeconds = autoGain + beatDetection + fxRouting;

  return {
    totalSavedSeconds,
    byCategory: { autoGain, beatDetection, fxRouting },
  };
}
