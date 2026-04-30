/**
 * pages/multi-track-panel/constants.ts
 * Shared constants for MultiTrackPanel.
 * THEME_COLORS is a dead import in the monolith — exported for resolution only.
 */
export const THEME_COLORS = {
  primary:   '#a3e635',
  secondary: '#22d3ee',
  warning:   '#f59e0b',
  danger:    '#ef4444',
} as const;

export const TRACK_COLORS: string[] = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#06b6d4', '#84cc16', '#a855f7', '#f43f5e',
];

/** Maps FXType string → short display label. */
export const FX_ICONS: Record<string, string> = {
  EQ:         'EQ',
  Compressor: 'CMP',
  Reverb:     'REV',
  Delay:      'DLY',
  Saturation: 'SAT',
  Limiter:    'LIM',
  Filter:     'FLT',
  Chorus:     'CHR',
  Phaser:     'PHS',
  Distortion: 'DST',
};
