#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.r3-native-theme-backup-$STAMP"

mkdir -p "$BACKUP"

echo "============================================================"
echo "R3 NATIVE — PREMIUM MATTE / ACID THEME PASS"
echo "============================================================"
echo
echo "Root:   $ROOT"
echo "Backup: $BACKUP"
echo

# ------------------------------------------------------------
# Safety
# ------------------------------------------------------------

if [[ ! -f "client/src/styles/theme.css" ]]; then
  echo "[ERROR] client/src/styles/theme.css not found."
  exit 1
fi

cp -a "client/src/styles/theme.css" "$BACKUP/theme.css"

echo "[OK] Existing theme backed up."

# ------------------------------------------------------------
# Append the premium R3 NATIVE visual layer.
#
# IMPORTANT:
# This intentionally does NOT alter:
# - layout
# - component hierarchy
# - routing
# - audio architecture
# - spacing systems
# - application state
# - component markup
#
# It only establishes visual treatment through semantic CSS.
# ------------------------------------------------------------

cat >> client/src/styles/theme.css <<'CSS'

/* ============================================================
   R3 NATIVE — PREMIUM MATTE / ACID VISUAL SYSTEM
   ------------------------------------------------------------
   Philosophy:
   matte black / precision green / technical restraint

   This layer intentionally preserves the existing UI geometry.
   It upgrades visual hierarchy without redesigning the product.
   ============================================================ */

:root {
  /* ----------------------------------------------------------
     R3 CORE MATERIALS
     ---------------------------------------------------------- */

  --r3-void: #070807;
  --r3-black: #0a0b0a;
  --r3-matte: #0d0f0d;
  --r3-surface: #111411;
  --r3-surface-raised: #151815;
  --r3-surface-hover: #191d19;
  --r3-surface-active: #1d221d;

  /* ----------------------------------------------------------
     R3 STRUCTURAL COLORS
     ---------------------------------------------------------- */

  --r3-border: rgba(224, 255, 228, 0.105);
  --r3-border-strong: rgba(224, 255, 228, 0.17);
  --r3-border-accent: rgba(185, 255, 0, 0.38);

  --r3-divider: rgba(255, 255, 255, 0.065);

  /* ----------------------------------------------------------
     R3 TYPOGRAPHY
     ---------------------------------------------------------- */

  --r3-text: #f0f4ef;
  --r3-text-secondary: #aeb6ae;
  --r3-text-muted: #737b73;
  --r3-text-dim: #505650;

  /* ----------------------------------------------------------
     R3 ACID
     ---------------------------------------------------------- */

  --r3-acid: #baff00;
  --r3-acid-bright: #d2ff4d;
  --r3-acid-deep: #8fca00;
  --r3-acid-dim: rgba(186, 255, 0, 0.12);
  --r3-acid-soft: rgba(186, 255, 0, 0.06);

  /* ----------------------------------------------------------
     R3 STATUS
     ---------------------------------------------------------- */

  --r3-success: #baff00;
  --r3-warning: #e7c95c;
  --r3-danger: #ff5c63;
  --r3-info: #82d9ff;

  /* ----------------------------------------------------------
     R3 DEPTH
     ---------------------------------------------------------- */

  --r3-shadow-sm:
    0 1px 2px rgba(0, 0, 0, 0.42);

  --r3-shadow-md:
    0 8px 24px rgba(0, 0, 0, 0.30);

  --r3-shadow-lg:
    0 18px 48px rgba(0, 0, 0, 0.38);

  --r3-glow-acid:
    0 0 0 1px rgba(186, 255, 0, 0.10),
    0 0 18px rgba(186, 255, 0, 0.055);

  /* ----------------------------------------------------------
     R3 GEOMETRY
     ---------------------------------------------------------- */

  --r3-radius-sm: 5px;
  --r3-radius-md: 8px;
  --r3-radius-lg: 11px;

  /* ----------------------------------------------------------
     R3 MOTION
     ---------------------------------------------------------- */

  --r3-transition:
    140ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* ============================================================
   MATTE FOUNDATION
   ============================================================ */

html[data-theme="dark"],
html[data-theme="acid"],
html.dark {
  background:
    radial-gradient(
      circle at 50% -20%,
      rgba(186, 255, 0, 0.025),
      transparent 34%
    ),
    var(--r3-void);

  color: var(--r3-text);
}

html[data-theme="dark"] body,
html[data-theme="acid"] body,
html.dark body {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.008),
      transparent 22%
    ),
    var(--r3-void);

  color: var(--r3-text);
}

/* ============================================================
   UNIVERSAL STRUCTURAL SEPARATION
   ------------------------------------------------------------
   Thin borders are deliberately subtle.
   They should be discovered, not shouted.
   ============================================================ */

html[data-theme="dark"] *,
html[data-theme="acid"] *,
html.dark * {
  border-color: var(--r3-border);
}

/* ============================================================
   PANELS / CARDS / SURFACES
   ============================================================ */

html[data-theme="dark"] [class*="card"],
html[data-theme="dark"] [class*="panel"],
html[data-theme="dark"] [class*="Card"],
html[data-theme="dark"] [class*="Panel"],
html[data-theme="acid"] [class*="card"],
html[data-theme="acid"] [class*="panel"],
html[data-theme="acid"] [class*="Card"],
html[data-theme="acid"] [class*="Panel"],
html.dark [class*="card"],
html.dark [class*="panel"],
html.dark [class*="Card"],
html.dark [class*="Panel"] {
  background-color: var(--r3-surface);
  border: 1px solid var(--r3-border);
  box-shadow: var(--r3-shadow-sm);
}

/* ============================================================
   INTERACTIVE SURFACES
   ============================================================ */

html[data-theme="dark"] button,
html[data-theme="dark"] input,
html[data-theme="dark"] textarea,
html[data-theme="dark"] select,
html[data-theme="acid"] button,
html[data-theme="acid"] input,
html[data-theme="acid"] textarea,
html[data-theme="acid"] select,
html.dark button,
html.dark input,
html.dark textarea,
html.dark select {
  transition:
    background-color var(--r3-transition),
    border-color var(--r3-transition),
    box-shadow var(--r3-transition),
    color var(--r3-transition),
    transform var(--r3-transition);
}

/* ------------------------------------------------------------
   BUTTONS
   ------------------------------------------------------------ */

html[data-theme="dark"] button,
html[data-theme="acid"] button,
html.dark button {
  border-color: var(--r3-border);
}

html[data-theme="dark"] button:hover,
html[data-theme="acid"] button:hover,
html.dark button:hover {
  border-color: var(--r3-border-strong);
  background-color: var(--r3-surface-hover);
}

html[data-theme="dark"] button:focus-visible,
html[data-theme="acid"] button:focus-visible,
html.dark button:focus-visible {
  outline: none;
  border-color: var(--r3-border-accent);
  box-shadow: var(--r3-glow-acid);
}

/* ============================================================
   FORM CONTROLS
   ============================================================ */

html[data-theme="dark"] input,
html[data-theme="dark"] textarea,
html[data-theme="dark"] select,
html[data-theme="acid"] input,
html[data-theme="acid"] textarea,
html[data-theme="acid"] select,
html.dark input,
html.dark textarea,
html.dark select {
  background: var(--r3-black);
  color: var(--r3-text);
  border: 1px solid var(--r3-border);
}

html[data-theme="dark"] input:focus,
html[data-theme="dark"] textarea:focus,
html[data-theme="dark"] select:focus,
html[data-theme="acid"] input:focus,
html[data-theme="acid"] textarea:focus,
html[data-theme="acid"] select:focus,
html.dark input:focus,
html.dark textarea:focus,
html.dark select:focus {
  border-color: var(--r3-border-accent);
  box-shadow: 0 0 0 1px rgba(186, 255, 0, 0.07);
  outline: none;
}

/* ============================================================
   PRIMARY ACID SIGNAL
   ------------------------------------------------------------
   Acid green is treated as DATA / ENERGY / STATE.
   ============================================================ */

html[data-theme="dark"] [data-active="true"],
html[data-theme="acid"] [data-active="true"],
html.dark [data-active="true"] {
  border-color: var(--r3-border-accent);
  box-shadow: var(--r3-glow-acid);
}

html[data-theme="dark"] [aria-current="page"],
html[data-theme="acid"] [aria-current="page"],
html.dark [aria-current="page"] {
  color: var(--r3-acid);
  border-color: var(--r3-border-accent);
}

/* ============================================================
   LINKS
   ============================================================ */

html[data-theme="dark"] a:hover,
html[data-theme="acid"] a:hover,
html.dark a:hover {
  color: var(--r3-acid-bright);
}

/* ============================================================
   SLIDERS
   ============================================================ */

html[data-theme="dark"] input[type="range"],
html[data-theme="acid"] input[type="range"],
html.dark input[type="range"] {
  accent-color: var(--r3-acid);
}

/* ============================================================
   CHECKBOXES / RADIOS
   ============================================================ */

html[data-theme="dark"] input[type="checkbox"],
html[data-theme="dark"] input[type="radio"],
html[data-theme="acid"] input[type="checkbox"],
html[data-theme="acid"] input[type="radio"],
html.dark input[type="checkbox"],
html.dark input[type="radio"] {
  accent-color: var(--r3-acid);
}

/* ============================================================
   SELECTION
   ============================================================ */

html[data-theme="dark"] ::selection,
html[data-theme="acid"] ::selection,
html.dark ::selection {
  background: rgba(186, 255, 0, 0.22);
  color: #ffffff;
}

/* ============================================================
   SCROLLBARS
   ============================================================ */

html[data-theme="dark"] *,
html[data-theme="acid"] *,
html.dark * {
  scrollbar-color:
    rgba(186, 255, 0, 0.22)
    rgba(255, 255, 255, 0.025);
}

html[data-theme="dark"] ::-webkit-scrollbar,
html[data-theme="acid"] ::-webkit-scrollbar,
html.dark ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

html[data-theme="dark"] ::-webkit-scrollbar-track,
html[data-theme="acid"] ::-webkit-scrollbar-track,
html.dark ::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.20);
}

html[data-theme="dark"] ::-webkit-scrollbar-thumb,
html[data-theme="acid"] ::-webkit-scrollbar-thumb,
html.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.105);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 999px;
}

html[data-theme="dark"] ::-webkit-scrollbar-thumb:hover,
html[data-theme="acid"] ::-webkit-scrollbar-thumb:hover,
html.dark ::-webkit-scrollbar-thumb:hover {
  background:
    rgba(186, 255, 0, 0.36);
  background-clip: padding-box;
}

/* ============================================================
   TECHNICAL HAIRLINE
   ------------------------------------------------------------
   Gives major surfaces the "precision hardware" character
   without adding decorative graphics or changing layout.
   ============================================================ */

html[data-theme="dark"] [data-r3-surface],
html[data-theme="acid"] [data-r3-surface],
html.dark [data-r3-surface] {
  border: 1px solid var(--r3-border);
  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.012),
      transparent
    ),
    var(--r3-surface);
}

/* ============================================================
   REDUCE VISUAL NOISE
   ============================================================ */

html[data-theme="dark"] .text-muted,
html[data-theme="acid"] .text-muted,
html.dark .text-muted {
  color: var(--r3-text-muted);
}

/* ============================================================
   ACCESSIBILITY
   ============================================================ */

@media (prefers-reduced-motion: reduce) {
  html[data-theme="dark"] *,
  html[data-theme="acid"] *,
  html.dark * {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
}

/* ============================================================
   END R3 NATIVE PREMIUM VISUAL SYSTEM
   ============================================================ */

CSS

echo "[OK] Premium R3 NATIVE visual layer installed."

# ------------------------------------------------------------
# Verify
# ------------------------------------------------------------

echo
echo "=== THEME SANITY CHECK ==="

grep -q -- "--r3-acid:" client/src/styles/theme.css
grep -q -- "--r3-border:" client/src/styles/theme.css
grep -q -- "--r3-surface:" client/src/styles/theme.css
grep -q 'data-theme="acid"' client/src/styles/theme.css
grep -q 'data-theme="dark"' client/src/styles/theme.css

echo "[OK] R3 semantic tokens present."
echo "[OK] Dark/acid selectors present."
echo "[OK] Structural border system present."

echo
echo "=== NO LAYOUT FILES CHANGED ==="
echo "Only:"
echo "  client/src/styles/theme.css"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "============================================================"
echo "R3 NATIVE THEME PASS COMPLETE"
echo "============================================================"
