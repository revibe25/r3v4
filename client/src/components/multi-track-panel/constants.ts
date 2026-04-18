// constants.ts - Centralized constants and configuration

import type { FXType } from './types';

export const THEME_COLORS = {
  dark: {
    bg: 'bg-slate-950',
    bgPanel: 'bg-slate-900',
    bgHover: 'hover:bg-slate-800',
    border: 'border-slate-800',
    text: 'text-slate-200',
    textMuted: 'text-slate-400',
  },
  light: {
    bg: 'bg-gray-50',
    bgPanel: 'bg-white',
    bgHover: 'hover:bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-900',
    textMuted: 'text-gray-600',
  },
};

export const COLOR_SCHEME = {
  dark: '#1a1a1a',
  light: '#ffffff',
  chrome: '#c5c9cc',
  purple: '#7f00ff',
  blue: '#007fff',
  forest: '#228B22',
};

export const FX_ICONS: Record<FXType, string> = {
  'EQ': '🎚️',
  'Compressor': '📊',
  'Reverb': '💫',
  'Delay': '⏱️',
  'Limiter': '🔒',
  'Saturation': '🔥',
  'Gate': '🚪',
  'DeEsser': '🎤',
  'VST': '🔌',
};

export const TRACK_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-purple-500',
  'bg-pink-500',
];

export const DEFAULT_BUFFER_SIZE = 512;
export const DEFAULT_SAMPLE_RATE = 48000;
export const DEFAULT_TEMPO = 120;
export const DEFAULT_TIME_SIGNATURE = '4/4';
export const MAX_ZOOM = 3;
export const MIN_ZOOM = 0.5;
export const ZOOM_STEP = 0.25;