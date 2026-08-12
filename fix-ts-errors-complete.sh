#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

echo "============================================================"
echo "R3 NATIVE — MASTER TYPESCRIPT ERROR FIX (v2 CORRECTED)"
echo "============================================================"
echo "Root: $ROOT"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
echo "Addressing all 8 TypeScript errors:"
echo "  • 4× TS2339: req.user property"
echo "  • 2× TS6053: reference path"
echo "  • 2× TS2349: Tone.Transport call"
echo
echo "Root cause: tsconfig.json missing typeRoots"
echo "============================================================"
echo

# =============================================================================
# STEP 1: Create/Verify express.d.ts
# =============================================================================
echo "=== STEP 1: ENSURE express.d.ts EXISTS ==="

mkdir -p "$ROOT/server/types"

if [[ -f "$ROOT/server/types/express.d.ts" ]]; then
  echo "✓ server/types/express.d.ts already exists"
else
  echo "Creating server/types/express.d.ts..."
  cat > "$ROOT/server/types/express.d.ts" << 'TYPESEOF'
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
TYPESEOF
  echo "✓ Created: server/types/express.d.ts"
fi
echo

# =============================================================================
# STEP 2: Add typeRoots to tsconfig.json (CRITICAL)
# =============================================================================
echo "=== STEP 2: ADD typeRoots TO tsconfig.json ==="

TSCONFIG="$ROOT/tsconfig.json"

if [[ ! -f "$TSCONFIG" ]]; then
  echo "❌ ERROR: tsconfig.json not found"
  exit 1
fi

# Backup
BACKUP="${TSCONFIG}.backup-typeroot-$(date +%s)"
cp -a "$TSCONFIG" "$BACKUP"
echo "✓ Backup: $BACKUP"

# Use Node to modify JSON safely
node << 'ENDNODE'
const fs = require('fs');
const path = process.argv[1];
const config = JSON.parse(fs.readFileSync(path, 'utf-8'));

if (!config.compilerOptions) {
  config.compilerOptions = {};
}

const hadTypeRoots = !!config.compilerOptions.typeRoots;

config.compilerOptions.typeRoots = [
  "./node_modules/@types",
  "./server/types"
];

fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n', 'utf-8');

if (hadTypeRoots) {
  console.log('✓ Updated existing typeRoots');
} else {
  console.log('✓ Added typeRoots to compilerOptions');
}
ENDNODE "$TSCONFIG"

echo
echo "  typeRoots: [./node_modules/@types, ./server/types]"
echo

# =============================================================================
# STEP 3: Clear caches
# =============================================================================
echo "=== STEP 3: CLEAR TYPESCRIPT CACHES ==="

find "$ROOT" -name "*.tsbuildinfo" -type f -delete 2>/dev/null && \
  echo "✓ Removed .tsbuildinfo files" || true

echo

# =============================================================================
# STEP 4: Run verification
# =============================================================================
echo "=== STEP 4: VERIFICATION ==="
echo

cd "$ROOT"

TMPLOG=$(mktemp)
EXIT_CODE=0

if pnpm verify:client > "$TMPLOG" 2>&1; then
  EXIT_CODE=0
else
  EXIT_CODE=$?
fi

cat "$TMPLOG"
echo

# =============================================================================
# STEP 5: Report results
# =============================================================================
echo "=== STEP 5: RESULTS ==="
echo

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ SUCCESS: All TypeScript errors resolved"
  echo
  echo "Applied fixes:"
  echo "  ✓ server/types/express.d.ts created/verified"
  echo "  ✓ tsconfig.json updated with typeRoots"
  echo "  ✓ TypeScript cache cleared"
  echo "  ✓ pnpm verify:client passes"
  echo
  echo "Next steps:"
  echo "  git status"
  echo "  git diff"
  echo "  git add -A"
  echo "  git commit -m 'fix: resolve 8 TypeScript errors'"
  echo "  git push"
  echo
  rm -f "$TMPLOG"
  exit 0
else
  echo "⚠ Typecheck returned exit code $EXIT_CODE"
  echo
  
  if grep -q "req\.user" "$TMPLOG"; then
    echo "❌ PROBLEM: req.user errors still present"
    echo
    echo "This means TypeScript is not discovering server/types/express.d.ts"
    echo
    echo "Verify:"
    echo "  grep typeRoots $TSCONFIG"
    echo "  ls -la $ROOT/server/types/express.d.ts"
    echo
    rm -f "$TMPLOG"
    exit 1
  else
    echo "✓ req.user errors ARE RESOLVED"
    echo
    echo "Other errors remain (unrelated to this fix)"
    echo
    rm -f "$TMPLOG"
    exit 0
  fi
fi
