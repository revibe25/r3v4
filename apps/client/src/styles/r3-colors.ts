/**
 * R3 Native — Color Token System
 * Version: 1.0
 * Theme: Cyberpunk AI Music Production
 * Founder: DJ Ernesto
 *
 * Usage:
 * - CSS: use CSS custom properties (--r3-neon-green, etc.)
 * - TypeScript: import { R3_COLORS } from '@shared/theme/r3-colors'
 * - Canvas: use .rgb or .rgba values for canvas context fillStyle
 */

// ==================== PRIMARY BRAND ====================
// RFQ-Official Manufacturing Specification v1.0 (Founder Edition)
// Primary: Cyber Purple #8E3CFF (Founder/Premium Brand)
// Secondary: Neon Green #B7FF00 (Active States, Accents, CTAs)

export const R3_COLORS = {
  // PRIMARY BRAND COLOR — Cyber Purple (Founder Edition)
  cyberPurple: '#8E3CFF', // Official primary brand, RGB 142-60-255
  
  // Secondary Brand (Premium/Accent)
  electricViolet: '#A14BFF',
  ultraViolet: '#BC6DFF',

  // Accent Green (Active states, CTAs, highlights)
  neonGreen: '#B7FF00', // Secondary accent, RGB 183-255-0
  electricLime: '#B7F500',
  toxicNeon: '#A8FF00',

  // Orange (Promo/Sales)
  orangePromo: '#FF8C1A',
  deepOrange: '#FF6A00',
  warningGold: '#FFC233',

  // Neutrals — RFQ Official Manufacturing Colors
  midnightBlack: '#080808', // Official black, RGB 8-8-8
  graphite: '#242424', // Official graphite, RGB 36-36-36
  titaniumSilver: '#E6E6E6', // Official light neutral, RGB 230-230-230
  
  // Legacy aliases (kept for compatibility)
  pureBlack: '#080808', // Maps to midnightBlack
  charcoal: '#242424', // Maps to graphite
  steelGray: '#3A3A3A', // Deprecated, use graphite
  softGray: '#777777', // Secondary text
  pureWhite: '#FFFFFF', // Pure white (unchanged)

  // Status / Transport
  record: '#FF3B30',
  play: '#00FF90',
  stop: '#FFFFFF',
  mute: '#888888',
  solo: '#FFD633',
  master: '#C8FF1A',
  peak: '#FF0000',

  // Audio Visualization
  audioKick: '#C8FF1A',
  audioBass: '#00C8FF',
  audioLead: '#A14BFF',
  audioPads: '#FF8C1A',
  audioVocals: '#00FF90',
  audioFX: '#FF3333',
  audioMaster: '#FFFFFF',

  // Semantic / UI
  success: '#00FF90',
  warning: '#FFC233',
  error: '#FF3B30',
  info: '#C8FF1A',
  muted: '#888888',
} as const;

// ==================== RGB VARIANTS (for canvas/WebGL) ====================
// RFQ-Official RGB values for manufacturing and digital
// Primary: Cyber Purple (142, 60, 255) — Founder Edition
// Secondary: Neon Green (183, 255, 0) — Active states & accents
export const R3_COLORS_RGB = {
  cyberPurple: { r: 142, g: 60, b: 255 }, // #8E3CFF RFQ Primary (Founder)
  electricViolet: { r: 161, g: 75, b: 255 },
  ultraViolet: { r: 188, g: 109, b: 255 },
  neonGreen: { r: 183, g: 255, b: 0 }, // #B7FF00 Secondary accent
  electricLime: { r: 183, g: 245, b: 0 },
  toxicNeon: { r: 168, g: 255, b: 0 },
  orangePromo: { r: 255, g: 140, b: 26 },
  deepOrange: { r: 255, g: 106, b: 0 },
  warningGold: { r: 255, g: 194, b: 51 },
  midnightBlack: { r: 8, g: 8, b: 8 }, // #080808 RFQ Official
  graphite: { r: 36, g: 36, b: 36 }, // #242424 RFQ Official
  titaniumSilver: { r: 230, g: 230, b: 230 }, // #E6E6E6 RFQ Official
  softGray: { r: 119, g: 119, b: 119 },
  pureWhite: { r: 255, g: 255, b: 255 },
  audioBass: { r: 0, g: 200, b: 255 },
  play: { r: 0, g: 255, b: 144 },
} as const;

// ==================== GLOW EFFECTS (for canvas shadow effects, CSS filters) ====================
// Primary: Cyber Purple (Founder Edition)
// Secondary: Neon Green (Active states, accents)
export const R3_GLOWS = {
  // Primary glow (RFQ official cyber purple)
  primaryGlow: 'rgba(142, 60, 255, 0.95)',
  primaryGlowSoft: 'rgba(142, 60, 255, 0.40)',

  // Secondary glow (neon green for active states)
  accentGlow: 'rgba(183, 255, 0, 0.95)',
  accentGlowSoft: 'rgba(183, 255, 0, 0.40)',

  // Orange glow
  orangeGlow: 'rgba(255, 140, 26, 0.60)',
} as const;

// ==================== GRADIENT DEFINITIONS ====================
export const R3_GRADIENTS = {
  // Main brand gradient (RFQ-official centered)
  mainBrand: {
    stops: ['#B7F500', '#B7FF00', '#A8FF00'], // #B7FF00 is RFQ official
    css: 'linear-gradient(90deg, #B7F500, #B7FF00, #A8FF00)',
  },

  // Premium Edition
  premium: {
    stops: ['#6F2EFF', '#A14BFF', '#C57EFF'],
    css: 'linear-gradient(90deg, #6F2EFF, #A14BFF, #C57EFF)',
  },

  // Flash Sale
  flashSale: {
    stops: ['#FF6A00', '#FF8C1A', '#FFC233'],
    css: 'linear-gradient(90deg, #FF6A00, #FF8C1A, #FFC233)',
  },

  // Background
  background: {
    stops: ['#000000', '#111111', '#1C1C1C'],
    css: 'linear-gradient(90deg, #000000, #111111, #1C1C1C)',
  },
} as const;

// ==================== BUTTON STYLES ====================
export const R3_BUTTON_STYLES = {
  primary: {
    background: R3_COLORS.midnightBlack, // RFQ Official
    border: `1px solid ${R3_COLORS.neonGreen}`,
    color: R3_COLORS.neonGreen,
    glow: R3_GLOWS.primaryGlow,
  },
  secondary: {
    background: R3_COLORS.graphite, // RFQ Official
    border: `1px solid ${R3_COLORS.graphite}`,
    color: R3_COLORS.pureWhite,
    glow: 'none',
  },
  danger: {
    background: R3_COLORS.record,
    border: `1px solid ${R3_COLORS.record}`,
    color: R3_COLORS.pureWhite,
    glow: `rgba(255, 59, 48, 0.5)`,
  },
  premium: {
    background: R3_COLORS.pureBlack,
    border: `1px solid ${R3_COLORS.cyberPurple}`,
    color: R3_COLORS.cyberPurple,
    glow: R3_GLOWS.purpleGlow,
  },
  sale: {
    background: R3_COLORS.pureBlack,
    border: `1px solid ${R3_COLORS.orangePromo}`,
    color: R3_COLORS.orangePromo,
    glow: R3_GLOWS.orangeGlow,
  },
} as const;

// ==================== CARD STYLE ====================
export const R3_CARD_STYLE = {
  background: R3_COLORS.graphite, // RFQ Official #242424
  border: `1px solid ${R3_COLORS.neonGreen}`,
  borderRadius: '18px',
  boxShadow: `0 0 20px ${R3_GLOWS.primaryGlowSoft}`,
  backdropFilter: 'blur(10px)',
  backgroundColor: 'rgba(36, 36, 36, 0.9)', // Updated to #242424
} as const;

// ==================== TYPOGRAPHY ====================
export const R3_TYPOGRAPHY = {
  headline: R3_COLORS.pureWhite,
  subheading: R3_COLORS.softGray,
  important: R3_COLORS.neonGreen,
  discount: R3_COLORS.deepOrange,
  founderEdition: R3_COLORS.cyberPurple,
  body: R3_COLORS.pureWhite,
  muted: R3_COLORS.softGray,
} as const;

// ==================== ICON COLORS ====================
export const R3_ICON_COLORS = {
  cloud: R3_COLORS.neonGreen,
  ai: R3_COLORS.neonGreen,
  daw: R3_COLORS.pureWhite,
  plugins: R3_COLORS.cyberPurple,
  samples: R3_COLORS.orangePromo,
  midi: R3_COLORS.pureWhite,
  browser: R3_COLORS.softGray,
} as const;

// ==================== UTILITY HELPERS ====================

/**
 * Convert hex to RGB string for use in canvas fillStyle
 * @param hex - Hex color value (e.g., '#C8FF1A')
 * @returns RGB string (e.g., 'rgb(200, 255, 26)')
 */
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 'rgb(0, 0, 0)';
  return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
}

/**
 * Add alpha/opacity to hex color
 * @param hex - Hex color value
 * @param alpha - Opacity (0-1)
 * @returns RGBA string
 */
export function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
}

/**
 * Apply R3 glow effect to canvas element
 * @param canvas - Canvas element
 * @param color - Color to glow
 * @param blur - Blur radius (default: 20)
 */
export function applyCanvasGlow(
  canvas: HTMLCanvasElement,
  color: string,
  blur: number = 20,
) {
  canvas.style.filter = `drop-shadow(0 0 ${blur}px ${color})`;
}

/**
 * Get gradient for canvas CanvasGradient
 * @param ctx - Canvas 2D context
 * @param gradient - Gradient definition from R3_GRADIENTS
 * @returns CanvasGradient object
 */
export function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  gradient: { stops: string[] },
  x0: number = 0,
  y0: number = 0,
  x1: number = 100,
  y1: number = 0,
): CanvasGradient {
  const canvasGradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.stops.forEach((color, i) => {
    canvasGradient.addColorStop(i / (gradient.stops.length - 1), color);
  });
  return canvasGradient;
}
