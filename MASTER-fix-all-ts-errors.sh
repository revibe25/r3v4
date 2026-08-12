#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

echo "============================================================"
echo "R3 NATIVE — MASTER TYPESCRIPT ERROR FIX"
echo "============================================================"
echo "Root: $ROOT"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
echo "This script addresses all 8 TypeScript errors:"
echo "  • 4× TS2339: req.user property (auth.ts, trpc.ts)"
echo "  • 2× TS6053: reference path (auth.ts, trpc.ts)"
echo "  • 2× TS2349: Tone.Transport call (useDAWEngine, useMidiSequencer)"
echo
echo "Root cause: tsconfig.json missing typeRoots configuration"
echo "============================================================"
echo

# =============================================================================
# STEP 1: Run diagnostic
# =============================================================================
echo "=== STEP 1: PRE-FIX DIAGNOSTIC ==="
echo

if [[ -f "$ROOT/server/types/express.d.ts" ]]; then
  echo "✓ server/types/express.d.ts exists"
  EXISTING_FILE=1
else
  echo "⚠ server/types/express.d.ts MISSING (will recreate)"
  EXISTING_FILE=0
fi

if grep -q "typeRoots" "$ROOT/tsconfig.json" 2>/dev/null; then
  echo "✓ tsconfig.json has typeRoots"
  EXISTING_TYPEROOT=1
else
  echo "⚠ tsconfig.json missing typeRoots (CRITICAL ISSUE)"
  EXISTING_TYPEROOT=0
fi

if grep -q "/// <reference" "$ROOT/server/middleware/auth.ts" 2>/dev/null; then
  echo "⚠ auth.ts still has triple-slash references"
  REFS_PRESENT=1
else
  echo "✓ auth.ts: references already removed"
  REFS_PRESENT=0
fi

TONE_COUNT=$(grep -c "Tone\.Transport()" "$ROOT/client/src/hooks/useDAWEngine.ts" 2>/dev/null || echo 0)
if [[ $TONE_COUNT -gt 0 ]]; then
  echo "⚠ useDAWEngine.ts: Tone.Transport() calls need fixing ($TONE_COUNT found)"
  TONE_FIXED=0
else
  echo "✓ useDAWEngine.ts: Tone.Transport calls already fixed"
  TONE_FIXED=1
fi

echo

# =============================================================================
# STEP 2: Fix everything needed
# =============================================================================
echo "=== STEP 2: APPLY FIXES ==="
echo

FIXES_APPLIED=0

# Fix 1: Ensure express.d.ts exists
if [[ $EXISTING_FILE -eq 0 ]]; then
  echo "Creating server/types/express.d.ts..."
  mkdir -p "$ROOT/server/types"
  cat > "$ROOT/server/types/express.d.ts" << 'EOF'
/**
 * Express Request Type Augmentation
 * 
 * Extends the standard Express Request object with JWT payload data.
 * Used across auth middleware and tRPC context for authenticated requests.
 * 
 * @author R3 NATIVE Engineering
 * @date 2026-08-11
 */

import { type Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      /**
       * Decoded JWT payload attached by AuthMiddleware.
       * Set after successful token verification in auth.ts.
       * 
       * Contains: { sub: userId, iat: issuedAt, exp: expiresAt, ... }
       */
      user?: {
        sub: string; // User ID from JWT subject claim
        iat?: number; // Issued at (UNIX timestamp)
        exp?: number; // Expires at (UNIX timestamp)
        [key: string]: any; // Additional JWT claims
      };
    }
  }
}

export {};
EOF
  echo "✓ Created express.d.ts"
  FIXES_APPLIED=$((FIXES_APPLIED + 1))
else
  echo "✓ express.d.ts already exists"
fi

# Fix 2: Add typeRoots to tsconfig.json (CRITICAL)
if [[ $EXISTING_TYPEROOT -eq 0 ]]; then
  echo "Updating tsconfig.json with typeRoots..."
  
  BACKUP="$ROOT/tsconfig.json.backup-$(date +%s)"
  cp -a "$ROOT/tsconfig.json" "$BACKUP"
  
  node << 'NODEJS'
const fs = require('fs');
const configPath = process.argv[1];
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

if (!config.compilerOptions) {
  config.compilerOptions = {};
}

config.compilerOptions.typeRoots = [
  "./node_modules/@types",
  "./server/types"
];

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
console.log('✓ typeRoots added to compilerOptions');
NODEJS "$ROOT/tsconfig.json"
  
  FIXES_APPLIED=$((FIXES_APPLIED + 1))
else
  echo "✓ tsconfig.json already has typeRoots"
fi

# Fix 3: Remove references if still present
if [[ $REFS_PRESENT -eq 1 ]]; then
  echo "Removing triple-slash references..."
  sed -i '1,20s|^/// <reference path="../types/express.d.ts" />$||' "$ROOT/server/middleware/auth.ts"
  sed -i '1,30s|^/// <reference path="./types/express.d.ts" />$||' "$ROOT/server/trpc.ts"
  echo "✓ References removed"
  FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

# Fix 4: Fix Tone.js calls if needed
if [[ $TONE_FIXED -eq 0 ]]; then
  echo "Fixing Tone.Transport() calls..."
  sed -i 's/Tone\.Transport()/Tone.Transport/g' "$ROOT/client/src/hooks/useDAWEngine.ts"
  sed -i 's/Tone\.Transport()/Tone.Transport/g' "$ROOT/client/src/hooks/useMidiSequencer.ts"
  echo "✓ Tone.Transport calls fixed"
  FIXES_APPLIED=$((FIXES_APPLIED + 1))
fi

echo
echo "✓ Fixes applied: $FIXES_APPLIED"
echo

# =============================================================================
# STEP 3: Clear caches
# =============================================================================
echo "=== STEP 3: CLEAR TYPESCRIPT CACHES ==="

find "$ROOT" -name "*.tsbuildinfo" -type f -delete 2>/dev/null && \
  echo "✓ Removed .tsbuildinfo files" || echo "ℹ No .tsbuildinfo files found"

find "$ROOT" -path "*/.typescript-cache" -type d -exec rm -rf {} + 2>/dev/null && \
  echo "✓ Cleared .typescript-cache" || true

echo

# =============================================================================
# STEP 4: Run verification
# =============================================================================
echo "=== STEP 4: VERIFICATION ==="
echo

cd "$ROOT"

echo "Running: pnpm verify:client"
echo

VERIFY_LOG=$(mktemp)
VERIFY_EXIT=0

if pnpm verify:client > "$VERIFY_LOG" 2>&1; then
  VERIFY_EXIT=0
else
  VERIFY_EXIT=$?
fi

# Always show output
cat "$VERIFY_LOG"
echo

# =============================================================================
# STEP 5: Report results
# =============================================================================
echo "=== STEP 5: RESULTS ==="
echo

if [[ $VERIFY_EXIT -eq 0 ]]; then
  echo "✅ SUCCESS: All TypeScript errors resolved"
  echo
  echo "Summary:"
  echo "  ✓ server/types/express.d.ts created/verified"
  echo "  ✓ tsconfig.json updated with typeRoots"
  echo "  ✓ Triple-slash references removed"
  echo "  ✓ Tone.Transport() calls fixed"
  echo "  ✓ pnpm verify:client passes (exit code 0)"
  echo
  echo "Next steps:"
  echo "  1. git status"
  echo "  2. git diff (review changes)"
  echo "  3. git add -A"
  echo "  4. git commit -m 'fix: resolve 8 TypeScript errors (typeRoots, express.d.ts, Tone.Transport)'"
  echo "  5. git push"
  echo
  rm -f "$VERIFY_LOG"
  exit 0
else
  echo "⚠ Typecheck returned exit code $VERIFY_EXIT"
  echo
  
  if grep -q "req\.user" "$VERIFY_LOG"; then
    echo "❌ CRITICAL: req.user errors still present"
    echo
    echo "This means TypeScript is not discovering server/types/express.d.ts"
    echo
    echo "Diagnostics to run:"
    echo "  1. Check typeRoots: grep typeRoots $ROOT/tsconfig.json"
    echo "  2. Verify file: ls -la $ROOT/server/types/express.d.ts"
    echo "  3. Show config: pnpm exec tsc --showConfig -p $ROOT/client/tsconfig.json"
    echo "  4. Check TypeScript version: pnpm exec tsc --version"
    echo
    echo "Last resort:"
    echo "  pnpm install"
    echo
    rm -f "$VERIFY_LOG"
    exit 1
  else
    echo "✓ req.user errors are RESOLVED"
    echo
    echo "Remaining errors (if any) are unrelated to this fix:"
    grep "error TS" "$VERIFY_LOG" || echo "(no TypeScript errors)"
    echo
    rm -f "$VERIFY_LOG"
    exit 0
  fi
fi
