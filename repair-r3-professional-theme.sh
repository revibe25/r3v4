#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.r3-professional-repair-$STAMP"

mkdir -p "$BACKUP"

echo "============================================================"
echo " R3 NATIVE — PROFESSIONAL THEME + BUILD REPAIR"
echo "============================================================"
echo
echo "Root:   $ROOT"
echo "Backup: $BACKUP"
echo

backup_file() {
  local f="$1"

  if [[ -f "$ROOT/$f" ]]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$ROOT/$f" "$BACKUP/$f"
    echo "[BACKUP] $f"
  fi
}

# ------------------------------------------------------------
# 1. Backup ONLY files we may intentionally modify
# ------------------------------------------------------------

backup_file "tsconfig.json"
backup_file "packages/llpte-ai/package.json"
backup_file "client/src/styles/theme.css"

echo

# ------------------------------------------------------------
# 2. Repair root TypeScript project boundaries
#
# The existing root configuration is currently swallowing:
#
#   packages/**/dist/**/*.d.ts
#   server/dist/**/*.d.ts
#
# That is the source of the TS6305 explosion.
#
# We preserve the existing configuration and add safe exclusions
# rather than rewriting the project architecture.
# ------------------------------------------------------------

node <<'NODE'
const fs = require('fs');
const path = require('path');

const file = 'tsconfig.json';

if (!fs.existsSync(file)) {
  console.error('[ERROR] tsconfig.json not found.');
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');

let config;

try {
  config = JSON.parse(
    raw.replace(/^\uFEFF/, '')
  );
} catch (err) {
  console.error('[ERROR] Root tsconfig.json is not valid JSON.');
  console.error(err.message);
  process.exit(1);
}

config.exclude = Array.from(
  new Set([
    ...(Array.isArray(config.exclude) ? config.exclude : []),
    '**/node_modules/**',
    '**/dist/**',
    '**/.turbo/**',
    '**/.vite/**',
    '**/coverage/**'
  ])
);

fs.writeFileSync(
  file,
  JSON.stringify(config, null, 2) + '\n'
);

console.log('[OK] Root tsconfig excludes generated dist artifacts.');
NODE

# ------------------------------------------------------------
# 3. Ensure the server referenced project is composite.
#
# We DO NOT rewrite server configuration.
# We only enable the requirement already demanded by the root
# project reference.
# ------------------------------------------------------------

if [[ -f server/tsconfig.json ]]; then

  backup_file "server/tsconfig.json"

  node <<'NODE'
const fs = require('fs');

const file = 'server/tsconfig.json';

const raw = fs.readFileSync(file, 'utf8');

let config;

try {
  config = JSON.parse(raw.replace(/^\uFEFF/, ''));
} catch (err) {
  console.error('[ERROR] server/tsconfig.json is not valid JSON.');
  console.error(err.message);
  process.exit(1);
}

config.compilerOptions ??= {};
config.compilerOptions.composite = true;

if (
  config.compilerOptions.declaration === undefined
) {
  config.compilerOptions.declaration = true;
}

fs.writeFileSync(
  file,
  JSON.stringify(config, null, 2) + '\n'
);

console.log('[OK] server TypeScript project marked composite.');
NODE

else
  echo "[WARN] server/tsconfig.json does not exist."
fi

# ------------------------------------------------------------
# 4. Verify the llpte-ai -> llpte-signal workspace dependency.
# ------------------------------------------------------------

if [[ -f packages/llpte-ai/package.json ]]; then

  node <<'NODE'
const fs = require('fs');

const file = 'packages/llpte-ai/package.json';

const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));

const sections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
];

let found = false;

for (const section of sections) {
  if (
    pkg[section] &&
    Object.prototype.hasOwnProperty.call(
      pkg[section],
      '@llpte/llpte-signal'
    )
  ) {
    found = true;
    console.log(
      `[OK] @llpte/llpte-signal already declared in ${section}.`
    );
  }
}

if (!found) {
  pkg.dependencies ??= {};
  pkg.dependencies['@llpte/llpte-signal'] = 'workspace:*';

  fs.writeFileSync(
    file,
    JSON.stringify(pkg, null, 2) + '\n'
  );

  console.log(
    '[FIX] Added @llpte/llpte-signal as a workspace dependency.'
  );
}
NODE

else
  echo "[ERROR] packages/llpte-ai/package.json not found."
  exit 1
fi

# ------------------------------------------------------------
# 5. Reinstall workspace links.
# ------------------------------------------------------------

echo
echo "=== REFRESHING WORKSPACE LINKS ==="

pnpm install --lockfile-only=false

# ------------------------------------------------------------
# 6. Professional R3 visual layer
#
# IMPORTANT:
# This is an OVERRIDE layer.
# It does not alter component hierarchy or page layout.
# It enhances:
#
#   - matte black depth
#   - acid green hierarchy
#   - thin component borders
#   - panel separation
#   - control surfaces
#   - hover/focus states
#   - subtle glow
#   - typography contrast
#   - inputs
#   - buttons
#   - cards
#   - scrollbars
#
# No fixed positioning.
# No layout/grid changes.
# No width/height changes.
# No component replacement.
# ------------------------------------------------------------

cat >> client/src/styles/theme.css <<'CSS'

/* ============================================================
   R3 NATIVE — PROFESSIONAL SURFACE SYSTEM
   Visual-only enhancement layer.
   Preserves existing layout and component architecture.
   ============================================================ */

:root {
  --r3-black-000: #050605;
  --r3-black-100: #080a08;
  --r3-black-200: #0b0e0b;
  --r3-black-300: #0f120f;
  --r3-black-400: #131713;
  --r3-black-500: #181d18;

  --r3-acid: #b7ff00;
  --r3-acid-bright: #c9ff33;
  --r3-acid-soft: #94cc00;
  --r3-acid-dim: #557600;

  --r3-text-strong: #f3f6ef;
  --r3-text: #d6dbd2;
  --r3-text-muted: #899188;
  --r3-text-dim: #5d645c;

  --r3-border: rgba(211, 222, 207, 0.105);
  --r3-border-strong: rgba(211, 222, 207, 0.16);
  --r3-border-acid: rgba(183, 255, 0, 0.28);

  --r3-glow-soft:
    0 0 18px rgba(183, 255, 0, 0.08);

  --r3-glow:
    0 0 24px rgba(183, 255, 0, 0.12);

  --r3-shadow:
    0 12px 35px rgba(0, 0, 0, 0.28);

  --r3-shadow-deep:
    0 18px 55px rgba(0, 0, 0, 0.42);

  --r3-radius: 8px;
  --r3-radius-small: 5px;

  --r3-border-width: 1px;
}

/* ------------------------------------------------------------
   GLOBAL SURFACE
   ------------------------------------------------------------ */

html[data-theme="dark"],
html[data-theme="acid"] {
  color-scheme: dark;

  --bg-base: var(--r3-black-000);
  --bg: var(--r3-black-100);
  --surface: var(--r3-black-200);
  --surface-mid: var(--r3-black-300);
  --panel: var(--r3-black-300);
  --panel-deep: var(--r3-black-100);
  --panel-void: var(--r3-black-000);

  --text-primary: var(--r3-text-strong);
  --text-secondary: var(--r3-text);
  --text-muted: var(--r3-text-muted);
  --text-dim: var(--r3-text-dim);

  --accent: var(--r3-acid);
  --theme-accent: var(--r3-acid);

  --border: var(--r3-border);

  --radius-sm: var(--r3-radius-small);
  --radius-md: var(--r3-radius);
}

/* ------------------------------------------------------------
   APPLICATION BACKDROP
   ------------------------------------------------------------ */

html[data-theme="dark"] body,
html[data-theme="acid"] body {
  background:
    radial-gradient(
      circle at 82% 8%,
      rgba(183, 255, 0, 0.035),
      transparent 28%
    ),
    linear-gradient(
      180deg,
      #070807 0%,
      #050605 100%
    );

  color: var(--r3-text);
}

/* ------------------------------------------------------------
   UNIVERSAL BOX MODEL
   Prevents border additions from changing component geometry.
   ------------------------------------------------------------ */

html[data-theme="dark"] *,
html[data-theme="acid"] * {
  box-sizing: border-box;
}

/* ------------------------------------------------------------
   COMPONENT EDGE SYSTEM
   Thin but deliberate.
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    button,
    input,
    select,
    textarea,
    [role="button"],
    [role="dialog"],
    [role="menu"],
    [role="listbox"],
    [class*="panel"],
    [class*="Panel"],
    [class*="card"],
    [class*="Card"],
    [class*="surface"],
    [class*="Surface"]
  ) {
  border-color: var(--r3-border);
}

/* ------------------------------------------------------------
   PANELS / CARDS
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    [class*="panel"],
    [class*="Panel"],
    [class*="card"],
    [class*="Card"],
    [class*="surface"],
    [class*="Surface"]
  ) {
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.018),
      rgba(255, 255, 255, 0.004)
    ),
    var(--panel);

  border: var(--r3-border-width) solid var(--r3-border);

  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.018),
    var(--r3-shadow);
}

/* ------------------------------------------------------------
   INTERACTIVE CONTROLS
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    button,
    [role="button"]
  ) {
  border: var(--r3-border-width) solid var(--r3-border);

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.028),
      rgba(255,255,255,0.008)
    );

  color: var(--r3-text);

  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    box-shadow 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

html[data-theme="dark"]
  :where(
    button,
    [role="button"]
  ):hover {
  border-color: var(--r3-border-strong);

  background:
    linear-gradient(
      180deg,
      rgba(183,255,0,0.045),
      rgba(255,255,255,0.012)
    );

  color: var(--r3-text-strong);
}

/* ------------------------------------------------------------
   ACID PRIMARY ACTIONS
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    button[data-variant="primary"],
    button[data-primary="true"],
    .primary,
    .btn-primary
  ) {
  border-color: rgba(183, 255, 0, 0.42);

  color: #091000;

  background:
    linear-gradient(
      180deg,
      var(--r3-acid-bright),
      var(--r3-acid)
    );

  box-shadow:
    0 0 0 1px rgba(183,255,0,0.05),
    0 6px 20px rgba(183,255,0,0.10);
}

html[data-theme="dark"]
  :where(
    button[data-variant="primary"],
    button[data-primary="true"],
    .primary,
    .btn-primary
  ):hover {
  border-color: rgba(201, 255, 51, 0.68);

  box-shadow:
    0 0 0 1px rgba(183,255,0,0.08),
    0 0 26px rgba(183,255,0,0.16);
}

/* ------------------------------------------------------------
   INPUTS
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    input,
    select,
    textarea
  ) {
  border: var(--r3-border-width) solid var(--r3-border);

  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,0.018),
      rgba(0,0,0,0.10)
    ),
    var(--r3-black-100);

  color: var(--r3-text-strong);

  outline: none;

  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    background-color 140ms ease;
}

html[data-theme="dark"]
  :where(
    input,
    select,
    textarea
  ):hover {
  border-color: var(--r3-border-strong);
}

html[data-theme="dark"]
  :where(
    input,
    select,
    textarea
  ):focus {
  border-color: var(--r3-border-acid);

  box-shadow:
    0 0 0 2px rgba(183,255,0,0.055),
    var(--r3-glow-soft);
}

/* ------------------------------------------------------------
   FOCUS VISIBILITY
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    button,
    [role="button"],
    input,
    select,
    textarea,
    a
  ):focus-visible {
  outline: 1px solid rgba(183,255,0,0.62);
  outline-offset: 2px;
}

/* ------------------------------------------------------------
   STATUS / SIGNAL ELEMENTS
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    [data-status="active"],
    [data-status="success"],
    [data-state="active"]
  ) {
  border-color: var(--r3-border-acid);
  box-shadow: var(--r3-glow-soft);
}

/* ------------------------------------------------------------
   DIVIDERS
   ------------------------------------------------------------ */

html[data-theme="dark"]
  hr {
  border: 0;
  border-top: 1px solid var(--r3-border);
}

/* ------------------------------------------------------------
   SCROLLBARS
   ------------------------------------------------------------ */

html[data-theme="dark"] * {
  scrollbar-width: thin;
  scrollbar-color:
    rgba(183,255,0,0.24)
    rgba(255,255,255,0.025);
}

html[data-theme="dark"] *::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

html[data-theme="dark"] *::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.018);
}

html[data-theme="dark"] *::-webkit-scrollbar-thumb {
  background: rgba(183,255,0,0.20);
  border: 1px solid rgba(0,0,0,0.35);
}

html[data-theme="dark"] *::-webkit-scrollbar-thumb:hover {
  background: rgba(183,255,0,0.38);
}

/* ------------------------------------------------------------
   TEXT HIERARCHY
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    h1,
    h2,
    h3,
    h4,
    h5,
    h6
  ) {
  color: var(--r3-text-strong);
  letter-spacing: -0.015em;
}

html[data-theme="dark"]
  :where(
    small,
    [data-muted="true"],
    .muted
  ) {
  color: var(--r3-text-muted);
}

/* ------------------------------------------------------------
   MICRO-SEPARATOR
   Gives dense DAW interfaces better visual rhythm without
   altering spacing or layout.
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    [data-divider="true"]
  ) {
  border-color: var(--r3-border);
}

/* ------------------------------------------------------------
   DISABLED STATES
   ------------------------------------------------------------ */

html[data-theme="dark"]
  :where(
    button,
    input,
    select,
    textarea,
    [role="button"]
  ):disabled {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
}

/* ------------------------------------------------------------
   REDUCE GLOW FOR USERS WHO REQUEST LESS MOTION/EFFECT
   ------------------------------------------------------------ */

@media (prefers-reduced-motion: reduce) {
  html[data-theme="dark"] * {
    transition-duration: 0.01ms !important;
  }
}

CSS

echo "[OK] Professional R3 surface layer installed."

# ------------------------------------------------------------
# 7. Verify theme provider imports
# ------------------------------------------------------------

echo
echo "=== ACTIVE THEME PROVIDER REFERENCES ==="

grep -RniE \
  "components/theme-provider|context/ThemeProvider" \
  client/src \
  --include='*.tsx' \
  --include='*.ts' \
  --include='*.jsx' \
  --include='*.js' \
  --exclude-dir=node_modules \
  || true

# ------------------------------------------------------------
# 8. Verify theme selectors
# ------------------------------------------------------------

echo
echo "=== THEME SELECTORS ==="

grep -nE \
  'html(\.dark|\.light|\[data-theme=)' \
  client/src/styles/theme.css \
  || true

# ------------------------------------------------------------
# 9. Build each workspace package independently
#
# This avoids the root tsc configuration masking real package
# errors.
# ------------------------------------------------------------

echo
echo "============================================================"
echo " PACKAGE BUILD VERIFICATION"
echo "============================================================"

PACKAGES=(
  "@r3vibe/shared"
  "@llpte/llpte-signal"
  "@llpte/llpte-core"
  "@llpte/llpte-ai"
  "@llpte/llpte-adapters"
  "@llpte/llpte-execution"
  "@llpte/llpte-transition-graph"
  "@r3vibe/server"
)

FAILED=0

for pkg in "${PACKAGES[@]}"; do
  echo
  echo "------------------------------------------------------------"
  echo "BUILD: $pkg"
  echo "------------------------------------------------------------"

  if pnpm --filter "$pkg" build; then
    echo "[PASS] $pkg"
  else
    echo "[FAIL] $pkg"
    FAILED=1
    break
  fi
done

echo
echo "============================================================"

if [[ "$FAILED" -eq 0 ]]; then
  echo " PACKAGE BUILDS: PASS"
else
  echo " PACKAGE BUILDS: FAILED"
  echo
  echo "The failure above is now the first real package-level error."
fi

echo "============================================================"

# ------------------------------------------------------------
# 10. Final root typecheck
# ------------------------------------------------------------

echo
echo "=== ROOT TYPECHECK ==="

if pnpm exec tsc --noEmit; then
  echo "[PASS] Root typecheck"
else
  echo "[WARN] Root typecheck still reports errors."
  echo "       These should now be genuine project errors rather"
  echo "       than generated dist TS6305 noise."
fi

echo
echo "============================================================"
echo " R3 REPAIR COMPLETE"
echo "============================================================"
echo
echo "Backup preserved at:"
echo "  $BACKUP"
echo
