/**
 * @llpte/llpte-core — Engine Constants
 */

export const LLPTE_VERSION = '0.1.0';

/** Enterprise performance targets (documented SLA) */
export const PERFORMANCE_TARGETS = {
  transitionPredictionMs: 5,
  crossfadeExecutionMs:   10,
  cpuUsagePercent:        15,
  memoryMB:               50,
  trackAnalysisMs:        2000,
} as const;

/** Crossfade duration mapping by score bucket */
export const CROSSFADE_DURATION_MS = {
  excellent: 4000,   // score >= 0.85
  good:      8000,   // score >= 0.70
  average:   12000,  // score >= 0.50
  poor:      20000,  // score <  0.50
} as const;
