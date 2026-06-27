#!/bin/bash
# FINAL BUILD FIX — Complete cleanup + root tsconfig patch
# Usage: bash final_build_fix.sh [--apply]

set -e

DRY_RUN=true
if [[ "$1" == "--apply" ]]; then
  DRY_RUN=false
fi

echo "====== FINAL TypeScript Build Fix ======"
echo "Mode: $([ "$DRY_RUN" = true ] && echo "DRY-RUN" || echo "APPLY")"
echo ""

cd ~/Stable || exit 1

# Step 1: Aggressive .tsbuildinfo cache clean
echo "[1/2] Aggressive cache cleanup..."
if [ "$DRY_RUN" = true ]; then
  echo "  Would delete:"
  find packages -name ".tsbuildinfo" -type f 2>/dev/null | while read f; do echo "    $f"; done || true
  find packages -name "*.tsbuildinfo" -type f 2>/dev/null | while read f; do echo "    $f"; done || true
  echo "    .tsbuildinfo (root)"
  echo "    node_modules/.tsbuildinfo (if exists)"
else
  # Remove all .tsbuildinfo files
  find packages -name ".tsbuildinfo" -delete 2>/dev/null || true
  find packages -name "*.tsbuildinfo" -delete 2>/dev/null || true
  rm -f .tsbuildinfo 2>/dev/null || true
  rm -f node_modules/.tsbuildinfo 2>/dev/null || true
  
  # Also clean incremental build cache
  rm -rf packages/*/dist/.tsbuildinfo 2>/dev/null || true
  rm -f packages/llpte-signal/.tsbuildinfo 2>/dev/null || true
  
  echo "  ✓ Cleaned all .tsbuildinfo files"
  echo "  ✓ Removed build info cache"
fi

echo ""
echo "[2/2] Fixing root tsconfig.json tsBuildInfoFile path..."

if [ "$DRY_RUN" = true ]; then
  echo "  Would change in tsconfig.json:"
  echo "    FROM: \"tsBuildInfoFile\": \"./node_modules/typescript/tsbuildinfo\""
  echo "    TO:   \"tsBuildInfoFile\": \"./.tsbuildinfo\""
else
  # Use sed to replace the tsBuildInfoFile path (cross-platform safe)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's|"tsBuildInfoFile": "./node_modules/typescript/tsbuildinfo"|"tsBuildInfoFile": "./.tsbuildinfo"|g' tsconfig.json
  else
    sed -i 's|"tsBuildInfoFile": "./node_modules/typescript/tsbuildinfo"|"tsBuildInfoFile": "./.tsbuildinfo"|g' tsconfig.json
  fi
  
  # Verify change
  if grep -q '"tsBuildInfoFile": "./.tsbuildinfo"' tsconfig.json; then
    echo "  ✓ Fixed tsconfig.json tsBuildInfoFile path"
  else
    echo "  ✗ ERROR: Failed to update tsconfig.json"
    exit 1
  fi
fi

echo ""
echo "====== Verification ======"
echo "After applying, run:"
echo "  pnpm tsc --noEmit"
echo "  pnpm build"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "To apply: bash final_build_fix.sh --apply"
else
  echo "✓ Fixes applied. Ready for pnpm build."
fi
