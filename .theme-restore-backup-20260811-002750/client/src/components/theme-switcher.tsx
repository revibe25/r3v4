/**
 * ThemeSwitcher — R3 v4
 * Compact accent-toggle pill. Uses ThemeProvider — single source of truth.
 * Cycles through ACID → NEON → back, keeping all other themes accessible
 * via the HeaderControls dropdown.
 */

import { useCallback } from 'react';
import { useTheme } from '@/components/theme-provider';
import { THEMES, type Theme } from '@/lib/theme-config';

const FONT = '"IBM Plex Mono", "JetBrains Mono", monospace';

// Quick-toggle order for the pill button
const CYCLE: Theme[] = ['acid', 'neon', 'dark', 'chrome', 'forest', 'sunset', 'aurora', 'light'];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const meta = THEMES[theme] ?? THEMES['acid'];

  const cycle = useCallback(() => {
    const idx = CYCLE.indexOf(theme as Theme);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setTheme(next);
  }, [theme, setTheme]);

  const accent = meta.accent;
  const accentDim = `${accent}22`;
  const accentGlow = `${accent}44`;

  return (
    <button
      onClick={cycle}
      title={`Theme: ${meta.label} — click to cycle`}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '5px',
        padding:       '3px 8px',
        background:    accentDim,
        border:        `1px solid ${accentGlow}`,
        borderRadius:  '4px',
        cursor:        'pointer',
        fontFamily:    FONT,
        fontSize:      '9px',
        fontWeight:    600,
        letterSpacing: '0.08em',
        color:         accent,
        lineHeight:    1,
        height:        '22px',
        userSelect:    'none',
        flexShrink:    0,
        transition:    'border-color 0.15s, background 0.15s',
      }}
    >
      <span
        style={{
          width:        '6px',
          height:       '6px',
          borderRadius: '50%',
          background:   accent,
          boxShadow:    `0 0 4px ${accent}`,
          flexShrink:   0,
        }}
      />
      {meta.label.toUpperCase()}
    </button>
  );
}
