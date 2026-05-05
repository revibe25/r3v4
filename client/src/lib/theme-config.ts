// client/src/lib/theme-config.ts

export type Theme =
  | 'dark'
  | 'light'
  | 'acid'
  | 'neon'
  | 'chrome'
  | 'forest'
  | 'sunset'
  | 'aurora';

export type ThemeCategory = 'light' | 'dark';

export interface Gradient {
  from: string;
  via?: string;
  to: string;
}

export interface AudioProfile {
  bass: number;
  mid: number;
  treble: number;
  pulseIntensity: number;
}

export interface ThemeMetadata {
  label: string;
  isDark: boolean;
  category: ThemeCategory;
  accent: string;
  gradient: Gradient;
  audio: AudioProfile;
  description: string;
}

export const STORAGE_KEY = 'r3vibe-theme';

export const THEMES: Record<Theme, ThemeMetadata> = {
  dark: {
    label: 'Dark',
    description: 'Classic dark theme',
    isDark: true,
    category: 'dark',
    accent: '#a3e635',
    gradient: { from: '#0d0d0d', to: '#0a0a0a' },
    audio: { bass: 0.2, mid: 0.15, treble: 0.1, pulseIntensity: 0.1 },
  },
  light: {
    label: 'Light',
    description: 'Clean light theme',
    isDark: false,
    category: 'light',
    accent: '#5b21b6',
    gradient: { from: '#fafafa', to: '#f0f0f0' },
    audio: { bass: 0.1, mid: 0.1, treble: 0.1, pulseIntensity: 0.05 },
  },
  acid: {
    label: 'Acid',
    description: 'Acid lime — DAW core palette',
    isDark: true,
    category: 'dark',
    accent: '#a3e635',
    gradient: { from: '#0a0a0a', to: '#0d0d0d' },
    audio: { bass: 0.3, mid: 0.2, treble: 0.15, pulseIntensity: 0.2 },
  },
  neon: {
    label: 'Neon',
    description: 'Cyan neon — high contrast',
    isDark: true,
    category: 'dark',
    accent: '#00F5FF',
    gradient: { from: '#050505', via: '#001a1a', to: '#000d0d' },
    audio: { bass: 0.25, mid: 0.45, treble: 0.6, pulseIntensity: 0.35 },
  },
  chrome: {
    label: 'Chrome',
    description: 'Polished chrome finish',
    isDark: true,
    category: 'dark',
    accent: '#e8eaed',
    gradient: { from: '#e8eaed', via: '#9aa0a6', to: '#6c757d' },
    audio: { bass: 0.2, mid: 0.4, treble: 0.6, pulseIntensity: 0.2 },
  },
  forest: {
    label: 'Forest',
    description: 'Natural forest green',
    isDark: true,
    category: 'dark',
    accent: '#10b981',
    gradient: { from: '#064e3b', to: '#022c22' },
    audio: { bass: 0.3, mid: 0.4, treble: 0.2, pulseIntensity: 0.2 },
  },
  sunset: {
    label: 'Sunset',
    description: 'Warm sunset tones',
    isDark: true,
    category: 'dark',
    accent: '#f97316',
    gradient: { from: '#fb7185', to: '#7c2d12' },
    audio: { bass: 0.45, mid: 0.35, treble: 0.25, pulseIntensity: 0.3 },
  },
  aurora: {
    label: 'Aurora',
    description: 'Northern lights palette',
    isDark: true,
    category: 'dark',
    accent: '#d946ef',
    gradient: { from: '#00F5FF', via: '#8B5CF6', to: '#ec4899' },
    audio: { bass: 0.25, mid: 0.5, treble: 0.7, pulseIntensity: 0.4 },
  },
};

export const AVAILABLE_THEMES = Object.keys(THEMES) as Theme[];
