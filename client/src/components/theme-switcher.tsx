/**
 * ThemeSwitcher — R3 v4
 * Zone 1 right-side pill. Inline styles only — no Tailwind dependency.
 * Toggles between ACID (#a3e635) and NEON (#00F5FF) accent palettes.
 * Writes selection to localStorage and applies via CSS custom properties on :root.
 *
 * Mount directly in DAW.tsx Zone 1 right side — NOT via PageNav.
 * PageNav returns null on /instrument and /daw (PRD §9 routing contract).
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Palette definitions ─────────────────────────────────────────────────────

const THEMES = {
  ACID: {
    label: 'ACID',
    accent:     '#a3e635',
    accentDim:  'rgba(163,230,53,0.12)',
    accentGlow: 'rgba(163,230,53,0.25)',
    bg:         '#0a0a0a',
    surface:    '#0d0d0d',
    border:     '#1c1c1c',
    text:       '#e5e5e5',
  },
  NEON: {
    label: 'NEON',
    accent:     '#00F5FF',
    accentDim:  'rgba(0,245,255,0.10)',
    accentGlow: 'rgba(0,245,255,0.22)',
    bg:         '#09090b',
    surface:    '#0f0f12',
    border:     '#1a1a22',
    text:       '#e5e5e5',
  },
} as const;

type ThemeKey = keyof typeof THEMES;

const STORAGE_KEY = 'r3v4-theme';
const FONT = '"IBM Plex Mono", "JetBrains Mono", monospace';

// ─── CSS var injection ────────────────────────────────────────────────────────

function applyTheme(key: ThemeKey): void {
  const t = THEMES[key];
  const root = document.documentElement;
  root.style.setProperty('--neon-lime',      t.accent);
  root.style.setProperty('--neon-lime-dim',  t.accentDim);
  root.style.setProperty('--neon-lime-glow', t.accentGlow);
  root.style.setProperty('--r3-bg',          t.bg);
  root.style.setProperty('--r3-surface',     t.surface);
  root.style.setProperty('--r3-border',      t.border);
  root.style.setProperty('--r3-text',        t.text);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThemeSwitcher() {
  const [active, setActive] = useState<ThemeKey>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeKey | null;
      return stored && stored in THEMES ? stored : 'ACID';
    } catch {
      return 'ACID';
    }
  });

  useEffect(() => {
    applyTheme(active);
    try { localStorage.setItem(STORAGE_KEY, active); } catch { /* noop */ }
  }, [active]);

  const toggle = useCallback(() => {
    setActive(prev => prev === 'ACID' ? 'NEON' : 'ACID');
  }, []);

  const t = THEMES[active];

  return (
    <button
      onClick={toggle}
      title={`Theme: ${t.label} — click to switch`}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '5px',
        padding:        '3px 8px',
        background:     t.accentDim,
        border:         `1px solid ${t.accentGlow}`,
        borderRadius:   '4px',
        cursor:         'pointer',
        fontFamily:     FONT,
        fontSize:       '9px',
        fontWeight:     600,
        letterSpacing:  '0.08em',
        color:          t.accent,
        lineHeight:     1,
        height:         '22px',
        userSelect:     'none',
        flexShrink:     0,
        transition:     'border-color 0.15s, background 0.15s',
      }}
    >
      <span
        style={{
          width:        '6px',
          height:       '6px',
          borderRadius: '50%',
          background:   t.accent,
          boxShadow:    `0 0 4px ${t.accent}`,
          flexShrink:   0,
        }}
      />
      {t.label}
    </button>
  );
}
