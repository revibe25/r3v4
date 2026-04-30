#!/usr/bin/env python3
"""
r3v4_theme_switcher_wire.py — R3 v4 ThemeSwitcher Wire Patch
Wire.txt protocol: Read → Find → Verify → Write → TSC

Creates client/src/components/theme-switcher.tsx and wires
ThemeSwitcher into DAW.tsx Zone 1 right side adjacent to SessionChip.
PageNav is NOT touched — it returns null on /instrument and /daw.

Usage:
  python3 r3v4_theme_switcher_wire.py          # dry-run (default)
  python3 r3v4_theme_switcher_wire.py --run    # apply changes
"""

import sys
import os
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

DRY_RUN = '--run' not in sys.argv

REPO     = Path(os.path.expanduser('~/Stable'))
CLIENT   = REPO / 'client'
COMP_DIR = CLIENT / 'src' / 'components'
DAW_PATH = CLIENT / 'src' / 'pages' / 'DAW.tsx'
TS_OUT   = COMP_DIR / 'theme-switcher.tsx'

ACCENT = '#a3e635'
MODE   = 'DRY-RUN' if DRY_RUN else 'APPLY'

# ─── Component source ────────────────────────────────────────────────────────

COMPONENT = r'''/**
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
'''

# ─── Helpers ──────────────────────────────────────────────────────────────────

def banner(msg: str) -> None:
    print(f'\n{"═"*54}\n  {msg}\n{"═"*54}')

def ok(msg: str)   -> None: print(f'[  OK] {msg}')
def info(msg: str) -> None: print(f'[INFO] {msg}')
def warn(msg: str) -> None: print(f'[WARN] {msg}')
def fail(msg: str) -> None: print(f'[FAIL] {msg}'); sys.exit(1)

def dry(msg: str)  -> None:
    print(f'[INFO] DRY-RUN: {msg}')

# ─── Read phase ───────────────────────────────────────────────────────────────

def read_phase() -> tuple[str, list[str]]:
    """Read DAW.tsx and return (raw_text, lines)."""
    if not DAW_PATH.exists():
        fail(f'DAW.tsx not found at {DAW_PATH}')
    raw = DAW_PATH.read_text(encoding='utf-8')
    return raw, raw.splitlines()

def find_session_chip_import(lines: list[str]) -> int:
    """Find the line index of the SessionChip import. Returns -1 if not found."""
    for i, line in enumerate(lines):
        if 'SessionChip' in line and 'import' in line:
            return i
    return -1

def find_session_chip_jsx(lines: list[str]) -> int:
    """Find first line containing <SessionChip in JSX. Returns -1 if not found."""
    for i, line in enumerate(lines):
        stripped = line.strip()
        if '<SessionChip' in stripped:
            return i
    return -1

def already_imported(lines: list[str]) -> bool:
    return any('ThemeSwitcher' in line and 'import' in line for line in lines)

def already_used(lines: list[str]) -> bool:
    return any('<ThemeSwitcher' in line for line in lines)

# ─── Patch phase ─────────────────────────────────────────────────────────────

def patch_daw(lines: list[str]) -> list[str]:
    """
    1. Inject ThemeSwitcher import after SessionChip import line.
    2. Inject <ThemeSwitcher /> immediately before <SessionChip … in JSX.
    Returns modified lines list.
    """
    lines = list(lines)  # copy

    # ── Step 1: import ──────────────────────────────────────────────────────
    imp_idx = find_session_chip_import(lines)
    if imp_idx == -1:
        fail(
            'Could not locate SessionChip import in DAW.tsx.\n'
            '  Searched for: line containing both "SessionChip" and "import"\n'
            '  Manual action: add this line near your SessionChip import:\n'
            "    import { ThemeSwitcher } from '@/components/theme-switcher';"
        )

    new_import = "import { ThemeSwitcher } from '@/components/theme-switcher';"

    if already_imported(lines):
        info('ThemeSwitcher import already present — skipping import injection.')
    else:
        lines.insert(imp_idx + 1, new_import)
        ok(f'Import injected after line {imp_idx + 1}: {lines[imp_idx].strip()[:60]}')

    # ── Step 2: JSX usage ───────────────────────────────────────────────────
    # Re-find after potential line offset from import insertion
    jsx_idx = find_session_chip_jsx(lines)
    if jsx_idx == -1:
        fail(
            'Could not locate <SessionChip in DAW.tsx JSX.\n'
            '  Manual action: add <ThemeSwitcher /> immediately before <SessionChip'
        )

    if already_used(lines):
        info('<ThemeSwitcher /> already present — skipping JSX injection.')
    else:
        # Preserve indentation of the SessionChip line
        chip_line = lines[jsx_idx]
        indent = len(chip_line) - len(chip_line.lstrip())
        switcher_jsx = ' ' * indent + '<ThemeSwitcher />'
        lines.insert(jsx_idx, switcher_jsx)
        ok(f'<ThemeSwitcher /> injected before <SessionChip at line {jsx_idx + 1}')

    return lines

# ─── Backup ───────────────────────────────────────────────────────────────────

def backup() -> Path:
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    bdir = REPO / '.r3_theme_backups' / ts
    bdir.mkdir(parents=True, exist_ok=True)
    # backup DAW.tsx
    shutil.copy2(DAW_PATH, bdir / 'DAW.tsx.bak')
    # backup theme-switcher if it exists already
    if TS_OUT.exists():
        shutil.copy2(TS_OUT, bdir / 'theme-switcher.tsx.bak')
    ok(f'Backup → {bdir}')
    ok(f'Rollback: cp {bdir}/DAW.tsx.bak {DAW_PATH}')
    return bdir

# ─── TSC check ────────────────────────────────────────────────────────────────

def run_tsc() -> None:
    info('Running pnpm tsc --noEmit …')
    result = subprocess.run(
        ['pnpm', 'tsc', '--noEmit'],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        ok('TSC: 0 errors ✅')
    else:
        warn('TSC errors detected after patch:')
        print(result.stdout[-2000:] if result.stdout else '')
        print(result.stderr[-1000:] if result.stderr else '')
        print('\nRoll back with the backup path shown above if needed.')

# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    banner(f'r3v4_theme_switcher_wire.py\nMode: {MODE}\nAccent: {ACCENT}')

    # ── Verify repo structure ──────────────────────────────────────────────
    for p in [REPO, CLIENT, COMP_DIR, DAW_PATH]:
        if not p.exists():
            fail(f'Expected path not found: {p}')
    ok('Repo structure verified')

    # ── Read phase ─────────────────────────────────────────────────────────
    raw, lines = read_phase()
    info(f'DAW.tsx read — {len(lines)} lines')

    # ── Detect injection points ────────────────────────────────────────────
    imp_idx  = find_session_chip_import(lines)
    jsx_idx  = find_session_chip_jsx(lines)
    imp_done = already_imported(lines)
    jsx_done = already_used(lines)

    info(f'SessionChip import found at line {imp_idx + 1 if imp_idx >= 0 else "NOT FOUND"}')
    info(f'<SessionChip JSX found at line  {jsx_idx + 1 if jsx_idx >= 0 else "NOT FOUND"}')
    info(f'ThemeSwitcher import present:   {imp_done}')
    info(f'<ThemeSwitcher /> in JSX:       {jsx_done}')

    if imp_idx == -1:
        fail(
            'SessionChip import not found in DAW.tsx.\n'
            "  Search: grep -n 'SessionChip' ~/Stable/client/src/pages/DAW.tsx"
        )
    if jsx_idx == -1:
        fail(
            '<SessionChip not found in DAW.tsx JSX.\n'
            "  Search: grep -n '<SessionChip' ~/Stable/client/src/pages/DAW.tsx"
        )

    if DRY_RUN:
        dry(f'Would create {TS_OUT}')
        dry(f'Would inject ThemeSwitcher import after line {imp_idx + 1}')
        dry(f'Would inject <ThemeSwitcher /> before <SessionChip at line {jsx_idx + 1}')
        banner(
            'DRY-RUN complete — no files written.\n\n'
            '  Pass --run to apply changes.'
        )
        return

    # ── Backup ────────────────────────────────────────────────────────────
    backup()

    # ── Write component file ──────────────────────────────────────────────
    TS_OUT.write_text(COMPONENT, encoding='utf-8')
    ok(f'Component written → {TS_OUT}')

    # ── Patch DAW.tsx ─────────────────────────────────────────────────────
    patched = patch_daw(lines)
    DAW_PATH.write_text('\n'.join(patched) + '\n', encoding='utf-8')
    ok(f'DAW.tsx patched → {DAW_PATH}')

    # ── TSC check ─────────────────────────────────────────────────────────
    run_tsc()

    banner(
        'Patch complete.\n\n'
        '  Commit with:\n'
        "    git add client/src/components/theme-switcher.tsx \\\n"
        "            client/src/pages/DAW.tsx \\\n"
        "            client/src/styles/theme.css \\\n"
        "            client/tailwind.config.ts\n"
        "    git commit -m 'feat: add ThemeSwitcher + neon CSS tokens (ui-polish)'"
    )

if __name__ == '__main__':
    main()
