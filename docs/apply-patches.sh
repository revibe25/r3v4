#!/usr/bin/env bash
# apply-patches.sh
# Mythos audit 2026-04-22 — apply all security patches to ~/Stable
#
# Run from anywhere:
#   bash ~/apply-patches.sh
#
# What this does (in order):
#   1. Creates timestamped .bak files for every file being modified
#   2. Copies corrected files into place
#   3. Copies migration SQL to the migrations directory (or server/ if no migrations dir)
#   4. Copies SECURITY.md to project root
#   5. Adds esbuild override to pnpm.overrides (C-01)
#   6. Runs pnpm tsc --noEmit and reports result

set -euo pipefail

STABLE="$HOME/Stable"
PATCHES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS=$(date +%Y%m%d_%H%M%S)

echo "=== Mythos patch apply — $TS ==="
echo "Source : $PATCHES"
echo "Target : $STABLE"
echo ""

# ── Helper: backup + copy ─────────────────────────────────────────────────────
patch_file() {
  local src="$1"   # patch file path (absolute)
  local dst="$2"   # destination path (absolute)
  if [ -f "$dst" ]; then
    cp "$dst" "${dst}.bak.${TS}"
    echo "  BAK  ${dst}.bak.${TS}"
  fi
  cp "$src" "$dst"
  echo "  COPY $dst"
}

# ── File patches ──────────────────────────────────────────────────────────────

echo "[1/6] Patching server/index.ts (F-01, F-06, F-07)"
patch_file "$PATCHES/index.ts" "$STABLE/server/index.ts"

echo "[2/6] Patching server/routers/daw.ts (F-03, F-04, F-08, F-11)"
patch_file "$PATCHES/daw.ts" "$STABLE/server/routers/daw.ts"

echo "[3/6] Patching server/routers/adminRouter.ts (C-04)"
patch_file "$PATCHES/adminRouter.ts" "$STABLE/server/routers/adminRouter.ts"

echo "[4/6] Patching server/trpc.ts (C-06)"
patch_file "$PATCHES/trpc.ts" "$STABLE/server/trpc.ts"

echo "[5/6] Patching server/db/schema.ts (F-05)"
patch_file "$PATCHES/schema.ts" "$STABLE/server/db/schema.ts"

# ── Migration SQL ─────────────────────────────────────────────────────────────

echo "[6/6] Copying migration SQL"
MIGRATIONS_DIR=""
if [ -d "$STABLE/migrations" ]; then
  MIGRATIONS_DIR="$STABLE/migrations"
elif [ -d "$STABLE/server/migrations" ]; then
  MIGRATIONS_DIR="$STABLE/server/migrations"
elif [ -d "$STABLE/drizzle" ]; then
  MIGRATIONS_DIR="$STABLE/drizzle"
else
  MIGRATIONS_DIR="$STABLE/server"
  echo "  WARN no migrations/ dir found — placing SQL in $MIGRATIONS_DIR"
fi
cp "$PATCHES/0001_add_not_null_ownership.sql" "$MIGRATIONS_DIR/0001_add_not_null_ownership.sql"
echo "  COPY $MIGRATIONS_DIR/0001_add_not_null_ownership.sql"

# ── SECURITY.md ───────────────────────────────────────────────────────────────

if [ -f "$STABLE/SECURITY.md" ]; then
  cp "$STABLE/SECURITY.md" "$STABLE/SECURITY.md.bak.${TS}"
fi
cp "$PATCHES/SECURITY.md" "$STABLE/SECURITY.md"
echo "  COPY $STABLE/SECURITY.md"

# ── pnpm overrides — C-01 esbuild transitive fix ─────────────────────────────

PKGJSON="$STABLE/package.json"
if grep -q '"esbuild"' "$PKGJSON" 2>/dev/null; then
  # Check if it's already in overrides
  if python3 -c "
import json, sys
data = json.load(open('$PKGJSON'))
overrides = data.get('pnpm', {}).get('overrides', {})
if 'esbuild' in overrides:
    sys.exit(0)
else:
    sys.exit(1)
" 2>/dev/null; then
    echo "  SKIP pnpm.overrides.esbuild already set"
  else
    cp "$PKGJSON" "${PKGJSON}.bak.${TS}"
    python3 -c "
import json
data = json.load(open('$PKGJSON'))
if 'pnpm' not in data:
    data['pnpm'] = {}
if 'overrides' not in data['pnpm']:
    data['pnpm']['overrides'] = {}
data['pnpm']['overrides']['esbuild'] = '>=0.25.0'
with open('$PKGJSON', 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
"
    echo "  EDIT $PKGJSON — added pnpm.overrides.esbuild >=0.25.0 (C-01)"
  fi
fi

# ── TypeScript check ──────────────────────────────────────────────────────────

echo ""
echo "=== Running pnpm tsc --noEmit ==="
cd "$STABLE"
if pnpm tsc --noEmit 2>&1; then
  echo ""
  echo "=== ✅ TypeScript: CLEAN ==="
else
  echo ""
  echo "=== ❌ TypeScript errors — review above before deploying ==="
  exit 1
fi

echo ""
echo "=== Patch apply complete ==="
echo ""
echo "NEXT STEPS (manual):"
echo "  1. Run the migration SQL against your DB:"
echo "     psql \$DATABASE_URL -f $MIGRATIONS_DIR/0001_add_not_null_ownership.sql"
echo "  2. Run: pnpm install  (picks up the esbuild override)"
echo "  3. Run: pnpm audit    (verify esbuild finding clears)"
echo "  4. Review SECURITY.md deferred items — C-03 and F-10 have hard triggers"
echo "     before next beta release."
