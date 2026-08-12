// client/src/lib/theme-config.ts
/**
 * R3 v4 Theme System
 * Single source of truth for all theme definitions, palettes, and metadata.
 */
export const STORAGE_KEY = 'r3vibe-theme';
const DARK_PALETTE = {
    bg: '#0a0a0a', surface: '#0f0f0f', surface2: '#141414', border: '#222222',
    text: '#f0f0f0', textSecondary: '#aaaaaa', textMuted: '#666666',
    accent: '#a3e635', accentDim: '#8cc327', success: '#22c55e', warning: '#f59e0b', error: '#ef4444',
};
const LIGHT_PALETTE = {
    bg: '#fafafa', surface: '#f5f5f5', surface2: '#efefef', border: '#d1d5db',
    text: '#1f2937', textSecondary: '#6b7280', textMuted: '#9ca3af',
    accent: '#7c3aed', accentDim: '#6d28d9', success: '#16a34a', warning: '#d97706', error: '#dc2626',
};
const ACID_PALETTE = {
    bg: '#0a0a0a', surface: '#0d0d0d', surface2: '#131313', border: '#1a1a1a',
    text: '#ffffff', textSecondary: '#e0e0e0', textMuted: '#888888',
    accent: '#a3e635', accentDim: '#7fb426', success: '#86efac', warning: '#facc15', error: '#ff6b6b',
};
const NEON_PALETTE = {
    bg: '#050505', surface: '#0a0a0a', surface2: '#0f0f0f', border: '#1a1a1a',
    text: '#00f5ff', textSecondary: '#00cccc', textMuted: '#007777',
    accent: '#00f5ff', accentDim: '#00bfff', success: '#00ff00', warning: '#ffaa00', error: '#ff3366',
};
const CHROME_PALETTE = {
    bg: '#e8eaed', surface: '#f0f2f5', surface2: '#f8f9fa', border: '#dadce0',
    text: '#202124', textSecondary: '#5f6368', textMuted: '#9aa0a6',
    accent: '#1f71b8', accentDim: '#1557b0', success: '#0d9488', warning: '#ea8600', error: '#d33b27',
};
const FOREST_PALETTE = {
    bg: '#0a2e1a', surface: '#0f3d26', surface2: '#144a2f', border: '#1b5e3a',
    text: '#e0f2e0', textSecondary: '#b8d4b8', textMuted: '#7fa87f',
    accent: '#10b981', accentDim: '#059669', success: '#34d399', warning: '#fbbf24', error: '#f87171',
};
const SUNSET_PALETTE = {
    bg: '#3d1f1f', surface: '#5a2f2f', surface2: '#6d3a3a', border: '#8b4545',
    text: '#ffe4d6', textSecondary: '#f5c9b3', textMuted: '#d9a37f',
    accent: '#f97316', accentDim: '#ea580c', success: '#10b981', warning: '#fbbf24', error: '#fca5a5',
};
const AURORA_PALETTE = {
    bg: '#0a0a1a', surface: '#1a1a3a', surface2: '#2a2a4a', border: '#3a3a5a',
    text: '#e0d5ff', textSecondary: '#c5b3f7', textMuted: '#9b8fd6',
    accent: '#d946ef', accentDim: '#c026d3', success: '#34d399', warning: '#fbbf24', error: '#f87171',
};
export const THEMES = {
    dark: { label: 'Dark', description: 'Classic dark theme', isDark: true, category: 'dark', accent: '#a3e635', gradient: { from: '#0d0d0d', to: '#0a0a0a' }, audio: { bass: 0.2, mid: 0.15, treble: 0.1, pulseIntensity: 0.1 }, palette: DARK_PALETTE },
    light: { label: 'Light', description: 'Clean light theme', isDark: false, category: 'light', accent: '#7c3aed', gradient: { from: '#fafafa', to: '#f0f0f0' }, audio: { bass: 0.1, mid: 0.1, treble: 0.1, pulseIntensity: 0.05 }, palette: LIGHT_PALETTE },
    acid: { label: 'Acid', description: 'Acid lime — DAW core palette', isDark: true, category: 'dark', accent: '#a3e635', gradient: { from: '#0a0a0a', to: '#0d0d0d' }, audio: { bass: 0.3, mid: 0.2, treble: 0.15, pulseIntensity: 0.2 }, palette: ACID_PALETTE },
    neon: { label: 'Neon', description: 'Cyan neon — high contrast', isDark: true, category: 'dark', accent: '#00f5ff', gradient: { from: '#050505', via: '#001a1a', to: '#000d0d' }, audio: { bass: 0.25, mid: 0.45, treble: 0.6, pulseIntensity: 0.35 }, palette: NEON_PALETTE },
    chrome: { label: 'Chrome', description: 'Polished chrome finish', isDark: false, category: 'light', accent: '#1f71b8', gradient: { from: '#e8eaed', via: '#f0f2f5', to: '#f8f9fa' }, audio: { bass: 0.2, mid: 0.4, treble: 0.6, pulseIntensity: 0.2 }, palette: CHROME_PALETTE },
    forest: { label: 'Forest', description: 'Natural forest green', isDark: true, category: 'dark', accent: '#10b981', gradient: { from: '#0a2e1a', to: '#051c0f' }, audio: { bass: 0.3, mid: 0.4, treble: 0.2, pulseIntensity: 0.2 }, palette: FOREST_PALETTE },
    sunset: { label: 'Sunset', description: 'Warm sunset tones', isDark: true, category: 'dark', accent: '#f97316', gradient: { from: '#3d1f1f', to: '#2a0f0f' }, audio: { bass: 0.45, mid: 0.35, treble: 0.25, pulseIntensity: 0.3 }, palette: SUNSET_PALETTE },
    aurora: { label: 'Aurora', description: 'Northern lights palette', isDark: true, category: 'dark', accent: '#d946ef', gradient: { from: '#0a0a1a', to: '#1a0a2a' }, audio: { bass: 0.25, mid: 0.5, treble: 0.7, pulseIntensity: 0.4 }, palette: AURORA_PALETTE },
};
export const AVAILABLE_THEMES = Object.keys(THEMES);
