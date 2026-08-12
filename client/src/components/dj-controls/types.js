// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════
export const ACID = '#a3e635';
export const DJ_BLACK = 'var(--dj-black)';
export const DJ_SURFACE = 'var(--dj-surface)';
export const DJ_SURFACE2 = 'var(--dj-surface2)';
export const DJ_BORDER = 'var(--dj-border)';
export const DJ_DIM = 'var(--dj-dim)';
export const DJ_DIMMER = 'var(--dj-dimmer)';
// ═══════════════════════════════════════════════════════════════════════════
// KNOB CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════════════════
export const KNOB_ARC = 270;
export const KNOB_START = -225;
export function describeArc(cx, cy, r, startDeg, endDeg) {
    const rad = (d) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(startDeg));
    const y1 = cy + r * Math.sin(rad(startDeg));
    const x2 = cx + r * Math.cos(rad(endDeg));
    const y2 = cy + r * Math.sin(rad(endDeg));
    const sweep = endDeg - startDeg;
    const large = Math.abs(sweep) > 180 ? 1 : 0;
    const dir = sweep > 0 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${dir} ${x2} ${y2}`;
}
