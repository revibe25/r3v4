/**
 * R3 Native — Theme System Barrel Export
 * Single import point for all color, type, and utility exports
 * Usage: import { R3_COLORS, R3_WAVEFORMS } from '@shared/theme';
 */

// Core colors
export {
  R3_COLORS,
  R3_COLORS_RGB,
  R3_GLOWS,
  R3_GRADIENTS,
  R3_BUTTON_STYLES,
  R3_CARD_STYLE,
  R3_TYPOGRAPHY,
  R3_ICON_COLORS,
  hexToRgb,
  hexToRgba,
  applyCanvasGlow,
  createCanvasGradient,
} from './colors';

// Audio colors
export {
  R3_WAVEFORMS,
  R3_SPECTRUM,
  R3_VU_METER,
  R3_TRANSPORT,
  R3_CLIPPING,
  R3_FREQUENCY_BANDS,
  R3_AUTOMATION,
  R3_CLIP_COLORS,
  R3_MIXER_CHANNELS,
  createSpectrumGradient,
  getWaveformColor,
  getMixerChannelColor,
  interpolateColor,
  getRGBArray,
} from './audio';

// Types
export type {
  ColorKey,
  AudioColorKey,
  GradientKey,
  SpectrumType,
  ButtonVariant,
  CardVariant,
  BadgeType,
  WaveformProps,
  VUMeterProps,
  SpectrumProps,
} from './types';
