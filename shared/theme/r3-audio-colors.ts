import { R3_COLORS } from './r3-colors';

export const R3_WAVEFORMS = {
  master: R3_COLORS.cyberPurple,
  kick: R3_COLORS.neonGreen,
  bass: '#00C8FF',
  lead: R3_COLORS.electricViolet,
  pads: R3_COLORS.orangePromo,
  vocals: R3_COLORS.play,
  fx: R3_COLORS.record,
  ambience: R3_COLORS.ultraViolet,
  sub: '#0080FF',
  low: '#00C8FF',
  lowMid: '#00FF90',
  mid: R3_COLORS.neonGreen,
  highMid: R3_COLORS.electricLime,
  high: R3_COLORS.toxicNeon,
  presence: '#FFD700',
  reference: R3_COLORS.softGray,
  silent: R3_COLORS.graphite,
} as const;

export const R3_SPECTRUM = {
  gradientDefault: ['#0080FF', '#00C8FF', '#00FF90', '#8E3CFF', '#B7FF00', '#FFD700', '#FF8C1A'],
  gradientAggressive: ['#000080', '#0080FF', '#00FF00', '#FFFF00', '#FF6A00', '#FF0000'],
  gradientWarm: ['#2C1654', '#6F2EFF', '#A14BFF', '#FF8C1A', '#FFC233'],
  gradientCool: ['#00C8FF', '#00FF90', '#B7F500', '#C8FF1A'],
} as const;

export const R3_VU_METER = {
  zones: {
    silent: R3_COLORS.charcoal,
    nominal: R3_COLORS.neonGreen,
    yellow: R3_COLORS.warningGold,
    red: R3_COLORS.record,
    peak: R3_COLORS.peak,
  },
  needleByLevel: (level: number): string => {
    if (level < 0.3) return R3_COLORS.neonGreen;
    if (level < 0.7) return R3_COLORS.neonGreen;
    if (level < 0.85) return R3_COLORS.warningGold;
    if (level < 1.0) return R3_COLORS.record;
    return R3_COLORS.peak;
  },
} as const;

export const R3_TRANSPORT = {
  play: R3_COLORS.play,
  pause: R3_COLORS.softGray,
  stop: R3_COLORS.pureWhite,
  record: R3_COLORS.record,
  recordArmed: R3_COLORS.record,
  mute: R3_COLORS.mute,
  muteActive: R3_COLORS.softGray,
  solo: R3_COLORS.solo,
  soloActive: R3_COLORS.solo,
  master: R3_COLORS.master,
} as const;

export const R3_FREQUENCY_BANDS = {
  sub20Hz: '#0040FF',
  bass60Hz: '#0080FF',
  lowMid250Hz: '#00C8FF',
  mid1kHz: '#8E3CFF',
  highMid4kHz: '#B7F500',
  presence8kHz: '#B7FF00',
  brilliance12kHz: '#FFD700',
  air16kHz: '#FF8C1A',
  presence20kHz: '#FF3333',
} as const;

export const R3_MIXER_CHANNELS = {
  vocals: '#00FF90',
  drums: R3_COLORS.neonGreen,
  bass: '#00C8FF',
  guitar: '#FFD700',
  piano: '#A14BFF',
  strings: '#FF8C1A',
  horns: '#FFC233',
  leads: R3_COLORS.orangePromo,
  pads: R3_COLORS.ultraViolet,
  fx: R3_COLORS.record,
  master: R3_COLORS.pureWhite,
  aux: R3_COLORS.softGray,
} as const;

export function createSpectrumGradient(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  spectrum: 'default' | 'aggressive' | 'warm' | 'cool' = 'default',
): CanvasGradient {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  const colors = spectrum === 'default' ? R3_SPECTRUM.gradientDefault : spectrum === 'aggressive' ? R3_SPECTRUM.gradientAggressive : spectrum === 'warm' ? R3_SPECTRUM.gradientWarm : R3_SPECTRUM.gradientCool;
  colors.forEach((color, i) => { gradient.addColorStop(i / (colors.length - 1), color); });
  return gradient;
}

export function getWaveformColor(trackType: keyof typeof R3_WAVEFORMS): string {
  return R3_WAVEFORMS[trackType] || R3_COLORS.neonGreen;
}
