// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type PanelMode = 'compact' | 'normal' | 'professional';

export interface DJControlsProps {
  filterVal?: number;
  pitchSemitones?: number;
  crossfade?: number;
  onFilterChange?: (value: number) => void;
  onPitchChange?: (semitones: number) => void;
  onCrossfadeChange?: (value: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onCue?: () => void;
  isPlaying?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export const ACID       = '#b8ff00';
export const DJ_BLACK   = '#000000';
export const DJ_SURFACE = '#0c0c0c';
export const DJ_SURFACE2 = '#111111';
export const DJ_BORDER  = '#222222';
export const DJ_DIM     = '#444444';
export const DJ_DIMMER  = '#333333';

// ═══════════════════════════════════════════════════════════════════════════
// KNOB CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export const KNOB_ARC   = 270;
export const KNOB_START = -225;

export function describeArc(
  cx: number, cy: number, r: number, startDeg: number, endDeg: number,
): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startDeg));
  const y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(endDeg));
  const y2 = cy + r * Math.sin(rad(endDeg));
  const sweep = endDeg - startDeg;
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  const dir   = sweep > 0 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${dir} ${x2} ${y2}`;
}