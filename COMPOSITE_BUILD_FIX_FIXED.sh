#!/bin/bash
# COMPOSITE_BUILD_FIX_FIXED.sh
# FIXED VERSION: Repairs TypeScript project references in pnpm monorepo
#
# BUGS FIXED:
# - BUG-BASH-1: macOS sed incompatibility → cross-platform sed
# - BUG-BASH-2: Fragile indentation pattern → flexible regex
# - BUG-BASH-3: Incomplete grep pattern → improved pattern
# - BUG-BASH-4: Wrong find output format → proper count/message
# - BUG-BASH-5: Always prints "Cleared" → only if file exists
# - ISSUE-BASH-6: No directory validation → added
# - ISSUE-BASH-7: No error checking on sed → validation added
# - ISSUE-BASH-8: No JSON validation → added check
#
# Usage: bash COMPOSITE_BUILD_FIX_FIXED.sh [--apply]

set -e

DRY_RUN=true
if [[ "$1" == "--apply" ]]; then
  DRY_RUN=false
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "====== TypeScript Project References Fix ======"
echo "Dry-run mode: $DRY_RUN"
echo ""

# Validate directory
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo -e "${RED}ERROR: Not in R3 v4 monorepo root (missing pnpm-workspace.yaml)${NC}"
  echo "  Expected: ~/Stable/"
  exit 1
fi

# Array of LLPTE packages needing "composite": true
PACKAGES=(
  "packages/llpte-signal"
  "packages/llpte-core"
  "packages/llpte-ai"
  "packages/llpte-adapters"
  "packages/llpte-execution"
  "packages/llpte-transition-graph"
)

echo "[1/3] Adding 'composite: true' to LLPTE package tsconfigs..."
COMPOSITE_COUNT=0

for pkg in "${PACKAGES[@]}"; do
  tsconfig="$pkg/tsconfig.json"
  
  if [ ! -f "$tsconfig" ]; then
    echo "  ⚠ Missing: $tsconfig (skipped)"
    continue
  fi
  
  # Improved grep pattern: handle whitespace variations
  if grep -q '"composite"[[:space:]]*:[[:space:]]*true' "$tsconfig"; then
    echo "  ✓ $pkg (already set)"
  else
    echo "  ○ Patching: $pkg"
    
    if [ "$DRY_RUN" = true ]; then
      echo "    Would add: '\"composite\": true,' to compilerOptions"
    else
      # Cross-platform sed (works on macOS and Linux)
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' '/^[[:space:]]*"compilerOptions"[[:space:]]*:[[:space:]]*{/a\    "composite": true,' "$tsconfig"
      else
        sed -i '/^[[:space:]]*"compilerOptions"[[:space:]]*:[[:space:]]*{/a\    "composite": true,' "$tsconfig"
      fi
      
      # Validate sed succeeded
      if grep -q '"composite": true' "$tsconfig"; then
        echo "    ✓ Added composite: true"
        ((COMPOSITE_COUNT++))
      else
        echo -e "    ${RED}✗ ERROR: Failed to add composite flag${NC}"
        exit 1
      fi
    fi
  fi
done

echo ""
echo "[2/3] Removing stale .d.ts and .tsbuildinfo files..."

TOTAL_D_TS_DELETED=0
TOTAL_TSBUILDINFO_DELETED=0

for pkg in "${PACKAGES[@]}"; do
  dist_dir="$pkg/dist"
  d_ts_count=0
  
  if [ -d "$dist_dir" ]; then
    # Count .d.ts files
    d_ts_count=$(find "$dist_dir" -type f \( -name "*.d.ts" -o -name "*.d.ts.map" \) 2>/dev/null | wc -l)
    
    if [ "$d_ts_count" -gt 0 ]; then
      if [ "$DRY_RUN" = true ]; then
        echo "    Would delete $d_ts_count .d.ts files from $dist_dir"
      else
        find "$dist_dir" -type f -name "*.d.ts" -delete 2>/dev/null || true
        find "$dist_dir" -type f -name "*.d.ts.map" -delete 2>/dev/null || true
        echo "    ✓ Deleted $d_ts_count .d.ts files from $dist_dir"
        ((TOTAL_D_TS_DELETED += d_ts_count))
      fi
    fi
  fi
done

echo ""
echo "[3/3] Removing .tsbuildinfo caches..."

for pkg in "${PACKAGES[@]}"; do
  tsbuildinfo_count=0
  
  if [ -f "$pkg/.tsbuildinfo" ]; then
    ((tsbuildinfo_count++))
  fi
  
  if [ -f "$pkg/dist/.tsbuildinfo" ]; then
    ((tsbuildinfo_count++))
  fi
  
  if [ "$tsbuildinfo_count" -gt 0 ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "    Would delete $tsbuildinfo_count .tsbuildinfo from $pkg"
    else
      rm -f "$pkg/.tsbuildinfo" "$pkg/dist/.tsbuildinfo" 2>/dev/null || true
      echo "    ✓ Deleted $tsbuildinfo_count .tsbuildinfo from $pkg"
      ((TOTAL_TSBUILDINFO_DELETED += tsbuildinfo_count))
    fi
  fi
done

# Clean root-level tsbuildinfo
if [ -f ".tsbuildinfo" ]; then
  if [ "$DRY_RUN" = true ]; then
    echo "    Would delete .tsbuildinfo (root)"
  else
    rm -f .tsbuildinfo 2>/dev/null || true
    echo "    ✓ Deleted .tsbuildinfo (root)"
    ((TOTAL_TSBUILDINFO_DELETED++))
  fi
fi

echo ""
echo "====== Verification ======"

if [ "$DRY_RUN" = true ]; then
  echo "Summary (dry-run):"
  echo "  Packages needing composite: (see above)"
  echo "  .d.ts files to delete: (see above)"
  echo "  .tsbuildinfo files to delete: (see above)"
  echo ""
  echo "To apply fixes, run:"
  echo "  bash COMPOSITE_BUILD_FIX_FIXED.sh --apply"
else
  echo "Summary (applied):"
  echo "  ✓ Composite flags added: $COMPOSITE_COUNT"
  echo "  ✓ .d.ts files deleted: $TOTAL_D_TS_DELETED"
  echo "  ✓ .tsbuildinfo files deleted: $TOTAL_TSBUILDINFO_DELETED"
  echo ""
  echo "Validating JSON files..."
  
  # Validate JSON files (requires Python3)
  for pkg in "${PACKAGES[@]}"; do
    tsconfig="$pkg/tsconfig.json"
    if [ -f "$tsconfig" ]; then
      if ! python3 -m json.tool "$tsconfig" > /dev/null 2>&1; then
        echo -e "${RED}✗ ERROR: Invalid JSON in $tsconfig${NC}"
        exit 1
      fi
    fi
  done
  
  echo "  ✓ All JSON files valid"
  echo ""
  echo "Next steps:"
  echo "  1. Verify: pnpm tsc --noEmit"
  echo "  2. Rebuild: pnpm build"
  echo "  3. Commit: git add packages/*/tsconfig.json"
fi

echo ""
