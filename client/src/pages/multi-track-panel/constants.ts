// ── RFC-EXEMPT: STATUS palette (§4.5) ────────────────────────────────────────
// Colors: var(--status-warn) (amber), var(--status-ok) (emerald), var(--accent-purple) (violet)
// Reason: Panel status constant definitions — single source of truth for multi-track states
// Approved: P2 remediation pass — see PRD §4.5 and tools/p2_patch.py
// ─────────────────────────────────────────────────────────────────────────────
/**
 * pages/multi-track-panel/constants.ts
 * Shared constants for MultiTrackPanel.
 * THEME_COLORS is a dead import in the monolith — exported for resolution only.
 */
export const THEME_COLORS = {
  primary:   '#a3e635',
  secondary: 'var(--looper-cyan)',
  warning:   'var(--status-warn)',
  danger:    '#ef4444',
} as const;

export const TRACK_COLORS: string[] = [
  'var(--looper-blue)', 'var(--status-ok)', 'var(--status-warn)', '#ef4444',
  'var(--accent-purple)', 'var(--track-pink)', 'var(--looper-teal)', 'var(--track-orange)',
  'var(--track-cyan)', 'var(--looper-lime)', 'var(--accent-violet)', 'var(--status-error)',
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
