export const R3_COLORS = {
  cyberPurple: '#8E3CFF',
  electricViolet: '#A14BFF',
  ultraViolet: '#BC6DFF',
  neonGreen: '#B7FF00',
  electricLime: '#B7F500',
  toxicNeon: '#A8FF00',
  orangePromo: '#FF8C1A',
  deepOrange: '#FF6A00',
  warningGold: '#FFC233',
  midnightBlack: '#080808',
  graphite: '#242424',
  titaniumSilver: '#E6E6E6',
  pureBlack: '#080808',
  charcoal: '#242424',
  steelGray: '#3A3A3A',
  softGray: '#777777',
  pureWhite: '#FFFFFF',
  record: '#FF3B30',
  play: '#00FF90',
  stop: '#FFFFFF',
  mute: '#888888',
  solo: '#FFD633',
  master: '#C8FF1A',
  peak: '#FF0000',
  audioKick: '#C8FF1A',
  audioBass: '#00C8FF',
  audioLead: '#A14BFF',
  audioPads: '#FF8C1A',
  audioVocals: '#00FF90',
  audioFX: '#FF3333',
  audioMaster: '#FFFFFF',
  success: '#00FF90',
  warning: '#FFC233',
  error: '#FF3B30',
  info: '#C8FF1A',
  muted: '#888888',
} as const;

export const R3_COLORS_RGB = {
  cyberPurple: { r: 142, g: 60, b: 255 },
  electricViolet: { r: 161, g: 75, b: 255 },
  ultraViolet: { r: 188, g: 109, b: 255 },
  neonGreen: { r: 183, g: 255, b: 0 },
  electricLime: { r: 183, g: 245, b: 0 },
  toxicNeon: { r: 168, g: 255, b: 0 },
  orangePromo: { r: 255, g: 140, b: 26 },
  deepOrange: { r: 255, g: 106, b: 0 },
  warningGold: { r: 255, g: 194, b: 51 },
  midnightBlack: { r: 8, g: 8, b: 8 },
  graphite: { r: 36, g: 36, b: 36 },
  titaniumSilver: { r: 230, g: 230, b: 230 },
  softGray: { r: 119, g: 119, b: 119 },
  pureWhite: { r: 255, g: 255, b: 255 },
  audioBass: { r: 0, g: 200, b: 255 },
  play: { r: 0, g: 255, b: 144 },
} as const;

export const R3_GLOWS = {
  primaryGlow: 'rgba(142, 60, 255, 0.95)',
  primaryGlowSoft: 'rgba(142, 60, 255, 0.40)',
  accentGlow: 'rgba(183, 255, 0, 0.95)',
  accentGlowSoft: 'rgba(183, 255, 0, 0.40)',
  orangeGlow: 'rgba(255, 140, 26, 0.60)',
} as const;

export const R3_GRADIENTS = {
  mainBrand: {
    stops: ['#6F2EFF', '#8E3CFF', '#A14BFF'],
    css: 'linear-gradient(90deg, #6F2EFF, #8E3CFF, #A14BFF)',
  },
  accentBrand: {
    stops: ['#B7F500', '#B7FF00', '#A8FF00'],
    css: 'linear-gradient(90deg, #B7F500, #B7FF00, #A8FF00)',
  },
  premium: {
    stops: ['#6F2EFF', '#A14BFF', '#C57EFF'],
    css: 'linear-gradient(90deg, #6F2EFF, #A14BFF, #C57EFF)',
  },
  flashSale: {
    stops: ['#FF6A00', '#FF8C1A', '#FFC233'],
    css: 'linear-gradient(90deg, #FF6A00, #FF8C1A, #FFC233)',
  },
  background: {
    stops: ['#080808', '#242424', '#1C1C1C'],
    css: 'linear-gradient(90deg, #080808, #242424, #1C1C1C)',
  },
} as const;

export const R3_BUTTON_STYLES = {
  primary: {
    background: R3_COLORS.midnightBlack,
    border: `1px solid ${R3_COLORS.cyberPurple}`,
    color: R3_COLORS.cyberPurple,
    glow: R3_GLOWS.primaryGlow,
  },
  secondary: {
    background: R3_COLORS.graphite,
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
    background: R3_COLORS.midnightBlack,
    border: `1px solid ${R3_COLORS.neonGreen}`,
    color: R3_COLORS.neonGreen,
    glow: R3_GLOWS.accentGlow,
  },
  sale: {
    background: R3_COLORS.midnightBlack,
    border: `1px solid ${R3_COLORS.orangePromo}`,
    color: R3_COLORS.orangePromo,
    glow: R3_GLOWS.orangeGlow,
  },
} as const;

export const R3_CARD_STYLE = {
  background: R3_COLORS.graphite,
  border: `1px solid ${R3_COLORS.cyberPurple}`,
  borderRadius: '18px',
  boxShadow: `0 0 20px ${R3_GLOWS.primaryGlowSoft}`,
  backdropFilter: 'blur(10px)',
  backgroundColor: 'rgba(36, 36, 36, 0.9)',
} as const;

export const R3_TYPOGRAPHY = {
  headline: R3_COLORS.pureWhite,
  subheading: R3_COLORS.softGray,
  important: R3_COLORS.neonGreen,
  discount: R3_COLORS.deepOrange,
  founderEdition: R3_COLORS.cyberPurple,
  body: R3_COLORS.pureWhite,
  muted: R3_COLORS.softGray,
} as const;

export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 'rgb(0, 0, 0)';
  return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
}
