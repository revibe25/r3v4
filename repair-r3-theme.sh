#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.theme-repair-backup-$STAMP"

mkdir -p "$BACKUP"

echo "============================================================"
echo "R3 THEME ARCHITECTURE REPAIR"
echo "============================================================"
echo
echo "Backup: $BACKUP"
echo

# ------------------------------------------------------------
# 1. Backup only the files we are intentionally changing
# ------------------------------------------------------------

for f in \
  client/src/styles/theme.css \
  client/src/components/theme-provider.tsx \
  client/src/lib/theme-config.ts
do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -a "$f" "$BACKUP/$f"
done

echo "[OK] Theme files backed up."

# ------------------------------------------------------------
# 2. Replace theme.css with a canonical semantic token layer
# ------------------------------------------------------------

cat > client/src/styles/theme.css <<'CSS'
/*
 * R3 NATIVE / R3v4
 * Canonical Theme System
 *
 * Architecture:
 *   theme-config.ts
 *          ↓
 *   ThemeProvider
 *          ↓
 *   html[data-theme="..."]
 *          ↓
 *   semantic CSS variables
 *
 * Components should consume semantic variables rather than
 * hard-coded theme-specific colors.
 */

/* ============================================================
   BASE / R3 CORE
   ============================================================ */

:root {
  color-scheme: dark;

  /* Core surfaces */
  --bg: #000000;
  --bg-base: #000000;
  --surface: #0c0c0c;
  --surface-mid: #111111;
  --panel: #050505;
  --panel-deep: #040404;
  --panel-void: #000000;

  /* Borders */
  --border: #222222;
  --dj-border: #222222;
  --dj-dim: #444444;
  --dj-dimmer: #333333;

  /* Text */
  --fg: #eaeaea;
  --text-primary: #f0f0f0;
  --text-secondary: #aaaaaa;
  --text-muted: #666666;
  --text-dim: #444444;

  /* R3 default accent */
  --accent: #bfff00;
  --theme-accent: #bfff00;
  --accent-neon-lime: #d4ff40;
  --accent-neon: #39ff14;

  /* Semantic states */
  --status-ok: #22c55e;
  --status-ok-dim: #3d7c00;
  --status-warn: #ffaa00;
  --status-error: #ff2244;

  /* Signal colors */
  --signal-clip: #ff2200;
  --signal-warn: #ffaa00;

  /* DAW compatibility */
  --dj-black: #000000;
  --dj-surface: #0c0c0c;
  --dj-surface2: #111111;
  --dj-surface3: #161616;
  --dj-muted: #666666;

  --daw-fg: #f0f0f0;
  --daw-sub: #aaaaaa;
  --daw-ghost: #cccccc;

  /* Looper palette */
  --looper-acid: #39ff14;
  --looper-acid-2: #32cd32;
  --looper-acid-dim: #4d6b18;
  --looper-cyan: #22d3ee;
  --looper-orange: #ff6b00;
  --looper-red: #ff1a1a;
  --looper-purple: #c084fc;
  --looper-yellow: #f5d000;
  --looper-pink: #f472b6;
  --looper-blue: #3b82f6;
  --looper-teal: #14b8a6;
  --looper-lime: #84cc16;

  /* Track colors */
  --track-pink: #ec4899;
  --track-cyan: #06b6d4;
  --track-orange: #f97316;
  --track-indigo: #6366f1;

  /* Geometry */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;

  /* Effects */
  --glow-sm: 0 0 4px color-mix(in srgb, var(--accent) 70%, transparent);
  --glow-md:
    0 0 12px color-mix(in srgb, var(--accent) 70%, transparent),
    0 0 24px color-mix(in srgb, var(--accent) 35%, transparent);
  --glow-lg:
    0 0 32px color-mix(in srgb, var(--accent) 80%, transparent),
    0 0 64px color-mix(in srgb, var(--accent) 35%, transparent);

  /* Compatibility aliases */
  --void: #060606;
  --t-b0: #090909;
  --t-b0x: #080808;
  --t-b0xx: #070707;
  --t-b1: #0f0f0f;
  --t-b2: #141414;
  --t-b2x: #1a1a1a;
  --t-b3: #1e1e1e;
  --t-b3x: #252525;
  --t-b4: #282828;

  --white: #ffffff;
}

/* ============================================================
   DARK — canonical original R3-style dark mode
   ============================================================ */

html.dark,
html[data-theme="dark"] {
  color-scheme: dark;

  --bg: #000000;
  --bg-base: #000000;
  --surface: #0c0c0c;
  --surface-mid: #111111;
  --panel: #050505;

  --border: #222222;
  --dj-border: #222222;

  --fg: #eaeaea;
  --text-primary: #f0f0f0;
  --text-secondary: #aaaaaa;
  --text-muted: #666666;

  --accent: #bfff00;
  --theme-accent: #bfff00;
}

/* ============================================================
   ACID — R3 DAW core palette
   ============================================================ */

html[data-theme="acid"] {
  color-scheme: dark;

  --bg: #000000;
  --bg-base: #000000;
  --surface: #090909;
  --surface-mid: #101010;
  --panel: #050505;

  --border: #283500;
  --dj-border: #283500;

  --fg: #f1f1f1;
  --text-primary: #f4f4f4;
  --text-secondary: #b5b5b5;
  --text-muted: #666666;

  --accent: #a3e635;
  --theme-accent: #a3e635;
  --accent-neon: #39ff14;
}

/* ============================================================
   LIGHT
   ============================================================ */

html.light,
html[data-theme="light"] {
  color-scheme: light;

  --bg: #fafafa;
  --bg-base: #fafafa;
  --surface: #ffffff;
  --surface-mid: #f0f0f0;
  --panel: #ffffff;

  --border: #d4d4d8;
  --dj-border: #d4d4d8;
  --dj-dim: #71717a;

  --fg: #18181b;
  --text-primary: #18181b;
  --text-secondary: #52525b;
  --text-muted: #71717a;
  --text-dim: #a1a1aa;

  --accent: #5b21b6;
  --theme-accent: #5b21b6;

  --signal-clip: #dc2626;
  --signal-warn: #d97706;
}

/* ============================================================
   NEON
   ============================================================ */

html[data-theme="neon"] {
  color-scheme: dark;

  --bg: #030505;
  --bg-base: #030505;
  --surface: #071010;
  --surface-mid: #0b1717;
  --panel: #050909;

  --border: #16494a;
  --dj-border: #16494a;

  --fg: #e8ffff;
  --text-primary: #ecffff;
  --text-secondary: #91bcbc;
  --text-muted: #527777;

  --accent: #00f5ff;
  --theme-accent: #00f5ff;
}

/* ============================================================
   CHROME
   ============================================================ */

html[data-theme="chrome"] {
  color-scheme: dark;

  --bg: #08090a;
  --bg-base: #08090a;
  --surface: #111315;
  --surface-mid: #1a1d20;
  --panel: #0d0f11;

  --border: #3c4146;
  --dj-border: #3c4146;
  --dj-dim: #777e85;

  --fg: #f1f3f5;
  --text-primary: #f4f5f6;
  --text-secondary: #adb3b9;
  --text-muted: #6f767d;

  --accent: #e8eaed;
  --theme-accent: #e8eaed;
}

/* ============================================================
   FOREST
   ============================================================ */

html[data-theme="forest"] {
  color-scheme: dark;

  --bg: #01140f;
  --bg-base: #01140f;
  --surface: #05221a;
  --surface-mid: #083126;
  --panel: #031b15;

  --border: #145b48;
  --dj-border: #145b48;
  --dj-dim: #467b6c;

  --fg: #e7fff6;
  --text-primary: #edfff8;
  --text-secondary: #a6cfc1;
  --text-muted: #5f9381;

  --accent: #10b981;
  --theme-accent: #10b981;
}

/* ============================================================
   SUNSET
   ============================================================ */

html[data-theme="sunset"] {
  color-scheme: dark;

  --bg: #160907;
  --bg-base: #160907;
  --surface: #21100c;
  --surface-mid: #301710;
  --panel: #1b0c09;

  --border: #713324;
  --dj-border: #713324;
  --dj-dim: #9b5a48;

  --fg: #fff2ec;
  --text-primary: #fff5f0;
  --text-secondary: #d7a99a;
  --text-muted: #8f6255;

  --accent: #f97316;
  --theme-accent: #f97316;
}

/* ============================================================
   AURORA
   ============================================================ */

html[data-theme="aurora"] {
  color-scheme: dark;

  --bg: #04050c;
  --bg-base: #04050c;
  --surface: #090b18;
  --surface-mid: #101329;
  --panel: #070913;

  --border: #31265c;
  --dj-border: #31265c;
  --dj-dim: #695d91;

  --fg: #f8f3ff;
  --text-primary: #fbf8ff;
  --text-secondary: #c5b9d9;
  --text-muted: #74698b;

  --accent: #d946ef;
  --theme-accent: #d946ef;
}

/* ============================================================
   GLOBAL BASE
   ============================================================ */

html,
body,
#root {
  min-height: 100%;
}

html,
body {
  background: var(--bg);
  color: var(--fg);
}

body {
  margin: 0;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.neon-border {
  border: 1.5px solid var(--accent);
  box-shadow: var(--glow-sm);
}

.neon-lift:hover {
  box-shadow: var(--glow-md);
  border-color: var(--accent);
}

.neon-text {
  color: var(--accent);
  text-shadow:
    0 0 6px color-mix(in srgb, var(--accent) 80%, transparent);
}

.neon-panel {
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: var(--glow-sm);
}

@keyframes neonPulse {
  0%,
  100% {
    box-shadow: var(--glow-sm);
  }

  50% {
    box-shadow: var(--glow-lg);
  }
}

.neon-pulse {
  animation: neonPulse 2s infinite ease-in-out;
}
CSS

echo "[OK] Canonical theme.css installed."

# ------------------------------------------------------------
# 3. Remove the render-blocking mounted gate
# ------------------------------------------------------------

python3 - <<'PY'
from pathlib import Path

p = Path("client/src/components/theme-provider.tsx")
s = p.read_text()

s = s.replace(
"""  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
""",
"""  const [mounted, setMounted] = useState(
    typeof window === 'undefined' ? false : true
  );

  useEffect(() => {
    setMounted(true);
  }, []);
"""
)

s = s.replace(
"""    if (!mounted || typeof window === 'undefined') return;
""",
"""    if (typeof window === 'undefined') return;
"""
)

s = s.replace(
"""  if (!mounted) return null;

  return (
""",
"""  return (
"""
)

p.write_text(s)
PY

echo "[OK] ThemeProvider no longer blanks the application during mount."

# ------------------------------------------------------------
# 4. Make theme application deterministic
# ------------------------------------------------------------

python3 - <<'PY'
from pathlib import Path

p = Path("client/src/components/theme-provider.tsx")
s = p.read_text()

old = """      // Set CSS custom properties for theme colors
      root.style.setProperty('--theme-accent', themeData.accent);
      
      // Set gradient variables
      root.style.setProperty('--theme-gradient-from', themeData.gradient.from);
      root.style.setProperty('--theme-gradient-to', themeData.gradient.to);
      if (themeData.gradient.via) {
        root.style.setProperty('--theme-gradient-via', themeData.gradient.via);
      }
"""

new = """      // Set only dynamic metadata variables here.
      // The actual visual palette lives in theme.css under
      // html[data-theme="..."] so CSS remains the source of truth.
      root.style.setProperty('--theme-accent', themeData.accent);
      root.style.setProperty('--theme-gradient-from', themeData.gradient.from);
      root.style.setProperty('--theme-gradient-to', themeData.gradient.to);

      if (themeData.gradient.via) {
        root.style.setProperty('--theme-gradient-via', themeData.gradient.via);
      } else {
        root.style.removeProperty('--theme-gradient-via');
      }
"""

if old not in s:
    raise SystemExit("Expected theme variable block was not found")

p.write_text(s.replace(old, new))
PY

echo "[OK] Theme metadata application normalized."

# ------------------------------------------------------------
# 5. Verify legacy provider is not imported
# ------------------------------------------------------------

if grep -RniE \
  "from ['\"][^'\"]*context/ThemeProvider['\"]|import ['\"][^'\"]*context/ThemeProvider['\"]" \
  client/src \
  --include='*.tsx' \
  --include='*.ts' \
  --include='*.jsx' \
  --include='*.js' \
  --exclude-dir=node_modules \
  >/tmp/r3-legacy-theme-provider.txt 2>/dev/null; then

  echo
  echo "WARNING: legacy context/ThemeProvider is still imported:"
  cat /tmp/r3-legacy-theme-provider.txt
else
  echo "[OK] Legacy ThemeProvider has no detected imports."
fi

# ------------------------------------------------------------
# 6. Verify active provider
# ------------------------------------------------------------

grep -Rni \
  "from './components/theme-provider'\|from '@/components/theme-provider'" \
  client/src \
  --include='*.tsx' \
  --include='*.ts' \
  --include='*.jsx' \
  --include='*.js' \
  --exclude-dir=node_modules \
  | head -50 || true

echo
echo "============================================================"
echo "REPAIR COMPLETE"
echo "============================================================"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "Changed:"
echo "  client/src/styles/theme.css"
echo "  client/src/components/theme-provider.tsx"
echo
echo "NOT changed:"
echo "  audio/DSP"
echo "  components"
echo "  package files"
echo "  Vite configuration"
echo "  untracked JS architecture"
echo "  legacy context/ThemeProvider"
echo
echo "Next:"
echo "  pnpm exec tsc --noEmit"
echo "  pnpm build"
echo
