/**
 * Auto-level mixing types and constants
 * Shared between LLPTE packages and server
 */

export interface AutoLevelConfig {
  targetLUFS: number;
  maxHeadroom: number;
  lookaheadMs: number;
}

export interface AutoLevelResult {
  suggestedGain: number;
  peakLevel: number;
  loudness: number;
}

export const AUTO_LEVEL_CONSTANTS = {
  TARGET_LUFS: -14,
  MAX_HEADROOM: 2,
  LOOKAHEAD_MS: 1000,
  CROSSFADE_MS: 100,
} as const;

export type AutoLevelConstants = typeof AUTO_LEVEL_CONSTANTS;
