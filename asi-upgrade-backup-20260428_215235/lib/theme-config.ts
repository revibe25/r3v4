// client/src/lib/theme-config.ts

export type Theme =
  | 'light'
  | 'dark'
  | 'chrome'
  | 'steel'
  | 'forest'
  | 'sunset'
  | 'midnight'
  | 'aurora'
  | 'bronze'
  | 'copper'
  | 'gold';

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
}

export const STORAGE_KEY = 'r3vibe-theme';

export const THEMES: Record<Theme, ThemeMetadata> = {
  light: {
    label: 'Light',
    isDark: false,
    category: 'light',
    accent: '#f59e0b',
    gradient: { from: '#fde68a', to: '#ffffff' },
    audio: { bass: 0.1, mid: 0.1, treble: 0.1, pulseIntensity: 0.05 },
  },
  dark: {
    label: 'Dark',
    isDark: true,
    category: 'dark',
    accent: '#3b82f6',
    gradient: { from: '#020617', to: '#020617' },
    audio: { bass: 0.2, mid: 0.15, treble: 0.1, pulseIntensity: 0.1 },
  },
  chrome: {
    label: 'Chrome',
    isDark: true,
    category: 'dark',
    accent: '#c5c9cc',
    gradient: { from: '#e8eaed', via: '#c5c9cc', to: '#6c757d' },
    audio: { bass: 0.2, mid: 0.4, treble: 0.6, pulseIntensity: 0.2 },
  },
  steel: {
    label: 'Steel',
    isDark: true,
    category: 'dark',
    accent: '#8b95a1',
    gradient: { from: '#5d6875', via: '#8b95a1', to: '#2d3339' },
    audio: { bass: 0.35, mid: 0.3, treble: 0.25, pulseIntensity: 0.15 },
  },
  forest: {
    label: 'Forest',
    isDark: true,
    category: 'dark',
    accent: '#10b981',
    gradient: { from: '#064e3b', to: '#022c22' },
    audio: { bass: 0.3, mid: 0.4, treble: 0.2, pulseIntensity: 0.2 },
  },
  sunset: {
    label: 'Sunset',
    isDark: true,
    category: 'dark',
    accent: '#f97316',
    gradient: { from: '#fb7185', to: '#7c2d12' },
    audio: { bass: 0.45, mid: 0.35, treble: 0.25, pulseIntensity: 0.3 },
  },
  midnight: {
    label: 'Midnight',
    isDark: true,
    category: 'dark',
    accent: '#4f46e5',
    gradient: { from: '#020617', to: '#000000' },
    audio: { bass: 0.6, mid: 0.25, treble: 0.1, pulseIntensity: 0.15 },
  },
  aurora: {
    label: 'Aurora',
    isDark: true,
    category: 'dark',
    accent: '#d946ef',
    gradient: { from: '#22d3ee', via: '#a855f7', to: '#ec4899' },
    audio: { bass: 0.25, mid: 0.5, treble: 0.7, pulseIntensity: 0.4 },
  },
  copper: {
    label: 'Copper',
    isDark: true,
    category: 'dark',
    accent: '#b87333',
    gradient: { from: '#f4c2a0', via: '#b87333', to: '#5f3317' },
    audio: { bass: 0.45, mid: 0.4, treble: 0.3, pulseIntensity: 0.25 },
  },
  gold: {
    label: 'Gold',
    isDark: true,
    category: 'dark',
    accent: '#d4af37',
    gradient: { from: '#ffd700', via: '#d4af37', to: '#806000' },
    audio: { bass: 0.3, mid: 0.45, treble: 0.4, pulseIntensity: 0.2 },
  },
  bronze: {
    label: 'Bronze',
    isDark: true,
    category: 'dark',
    accent: '#cd7f32',
    gradient: { from: '#d4af87', via: '#cd7f32', to: '#6b3410' },
    audio: { bass: 0.5, mid: 0.4, treble: 0.3, pulseIntensity: 0.3 },
  },
};

export const AVAILABLE_THEMES = Object.keys(THEMES) as Theme[];
