/**
 * R3 Native — Type Definitions
 * Comprehensive types for color system, ensuring type safety across DAW
 */

import { R3_COLORS, R3_GRADIENTS } from './colors';
import { R3_WAVEFORMS, R3_SPECTRUM, R3_VU_METER } from './audio';

// Extract literal types from color objects
export type ColorKey = keyof typeof R3_COLORS;
export type AudioColorKey = keyof typeof R3_WAVEFORMS;
export type GradientKey = keyof typeof R3_GRADIENTS;
export type SpectrumType = 'default' | 'aggressive' | 'warm' | 'cool';

// Button variants
export type ButtonVariant = 'primary' | 'secondary' | 'premium' | 'danger' | 'sale';

// Card variants
export type CardVariant = 'default' | 'premium';

// Badge types
export type BadgeType = 'success' | 'warning' | 'error' | 'premium' | 'info';

// Audio component props
export interface WaveformProps {
  trackType: AudioColorKey;
  width?: number;
  height?: number;
  animate?: boolean;
}

export interface VUMeterProps {
  level: number; // 0-1 normalized
  width?: number;
  height?: number;
}

export interface SpectrumProps {
  frequencyData?: Uint8Array;
  width?: number;
  height?: number;
  type?: SpectrumType;
}

// Export all color objects for re-export
export { R3_COLORS, R3_COLORS_RGB, R3_GLOWS, R3_GRADIENTS } from './colors';
export { R3_WAVEFORMS, R3_SPECTRUM, R3_VU_METER, R3_TRANSPORT, R3_CLIPPING } from './audio';
