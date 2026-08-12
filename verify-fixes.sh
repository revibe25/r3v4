#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
FAILED=0

echo "============================================================"
echo "R3 NATIVE — POST-FIX VERIFICATION PROTOCOL"
echo "============================================================"
echo "Root: $ROOT"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

# =============================================================================
# CHECK 1: express.d.ts exists and is properly structured
# =============================================================================
echo "=== CHECK 1: express.d.ts Exists ==="

if [[ ! -f "$ROOT/server/types/express.d.ts" ]]; then
  echo "❌ FAIL: server/types/express.d.ts not found"
  FAILED=$((FAILED + 1))
else
  echo "✓ File exists: server/types/express.d.ts"
  
  # Verify it has the required declarations
  if grep -q "declare global" "$ROOT/server/types/express.d.ts"; then
    echo "✓ Contains: declare global"
  else
    echo "❌ Missing: declare global"
    FAILED=$((FAILED + 1))
  fi
  
  if grep -q "namespace Express" "$ROOT/server/types/express.d.ts"; then
    echo "✓ Contains: namespace Express"
  else
    echo "❌ Missing: namespace Express"
    FAILED=$((FAILED + 1))
  fi
  
  if grep -q "interface Request" "$ROOT/server/types/express.d.ts"; then
    echo "✓ Contains: interface Request"
  else
    echo "❌ Missing: interface Request"
    FAILED=$((FAILED + 1))
  fi
  
  if grep -q "user?" "$ROOT/server/types/express.d.ts"; then
    echo "✓ Contains: user property declaration"
  else
    echo "❌ Missing: user property"
    FAILED=$((FAILED + 1))
  fi
fi
echo

# =============================================================================
# CHECK 2: Triple-slash references removed
# =============================================================================
echo "=== CHECK 2: Triple-Slash References Removed ==="

REFS_FOUND=0

if grep -n "/// <reference" "$ROOT/server/middleware/auth.ts" 2>/dev/null; then
  echo "❌ FAIL: auth.ts still has /// <reference directive"
  REFS_FOUND=$((REFS_FOUND + 1))
else
  echo "✓ auth.ts: reference removed"
fi

if grep -n "/// <reference" "$ROOT/server/trpc.ts" 2>/dev/null; then
  echo "❌ FAIL: trpc.ts still has /// <reference directive"
  REFS_FOUND=$((REFS_FOUND + 1))
else
  echo "✓ trpc.ts: reference removed"
fi

if [[ $REFS_FOUND -gt 0 ]]; then
  FAILED=$((FAILED + REFS_FOUND))
fi
echo

# =============================================================================
# CHECK 3: Tone.Transport() calls replaced with Tone.Transport
# =============================================================================
echo "=== CHECK 3: Tone.js Calls Fixed ==="

TONE_ERRORS=0

TONE_COUNT=$(grep -c "Tone\.Transport()" "$ROOT/client/src/hooks/useDAWEngine.ts" 2>/dev/null || echo 0)
if [[ $TONE_COUNT -gt 0 ]]; then
  echo "❌ FAIL: useDAWEngine.ts still has Tone.Transport() calls: $TONE_COUNT"
  grep -n "Tone\.Transport()" "$ROOT/client/src/hooks/useDAWEngine.ts"
  TONE_ERRORS=$((TONE_ERRORS + TONE_COUNT))
else
  echo "✓ useDAWEngine.ts: Tone.Transport() calls fixed"
fi

TONE_COUNT=$(grep -c "Tone\.Transport()" "$ROOT/client/src/hooks/useMidiSequencer.ts" 2>/dev/null || echo 0)
if [[ $TONE_COUNT -gt 0 ]]; then
  echo "❌ FAIL: useMidiSequencer.ts still has Tone.Transport() calls: $TONE_COUNT"
  grep -n "Tone\.Transport()" "$ROOT/client/src/hooks/useMidiSequencer.ts"
  TONE_ERRORS=$((TONE_ERRORS + TONE_COUNT))
else
  echo "✓ useMidiSequencer.ts: Tone.Transport() calls fixed"
fi

if [[ $TONE_ERRORS -gt 0 ]]; then
  FAILED=$((FAILED + TONE_ERRORS))
fi
echo

# =============================================================================
# CHECK 4: Run pnpm verify:client and capture results
# =============================================================================
echo "=== CHECK 4: TypeScript Compilation ==="

cd "$ROOT"

TYPECHECK_OUTPUT=$(mktemp)
TYPECHECK_EXIT=0

if pnpm verify:client > "$TYPECHECK_OUTPUT" 2>&1; then
  echo "✓ pnpm verify:client: PASSED (exit code 0)"
  echo "  No TypeScript errors found"
else
  TYPECHECK_EXIT=$?
  echo "❌ FAIL: pnpm verify:client (exit code $TYPECHECK_EXIT)"
  echo
  echo "--- TypeScript Output ---"
  cat "$TYPECHECK_OUTPUT" | tail -n 50
  echo "--- End Output ---"
  FAILED=$((FAILED + 1))
fi

rm -f "$TYPECHECK_OUTPUT"
echo

# =============================================================================
# CHECK 5: Count specific error classes (should be 0)
# =============================================================================
echo "=== CHECK 5: Error Classification ==="

if [[ $TYPECHECK_EXIT -eq 0 ]]; then
  echo "✓ No TS2349 errors (Tone.js call signatures)"
  echo "✓ No TS2339 errors (req.user property)"
  echo "✓ No TS6053 errors (reference path not found)"
else
  echo "⚠ TypeScript had errors; see CHECK 4 output above"
fi
echo

# =============================================================================
# CHECK 6: Git status for modified files
# =============================================================================
echo "=== CHECK 6: Git Status ==="

git -C "$ROOT" status --short -- \
  server/types/express.d.ts \
  server/middleware/auth.ts \
  server/trpc.ts \
  client/src/hooks/useDAWEngine.ts \
  client/src/hooks/useMidiSequencer.ts \
  2>/dev/null || true

echo
echo "Expected changes:"
echo "  A server/types/express.d.ts (new file)"
echo "  M server/middleware/auth.ts"
echo "  M server/trpc.ts"
echo "  M client/src/hooks/useDAWEngine.ts"
echo "  M client/src/hooks/useMidiSequencer.ts"
echo

# =============================================================================
# CHECK 7: Diff size validation (ensure changes are minimal)
# =============================================================================
echo "=== CHECK 7: Diff Size Validation ==="

DIFF_LINES=$(git -C "$ROOT" diff --stat -- \
  server/types/ \
  server/middleware/auth.ts \
  server/trpc.ts \
  client/src/hooks/useDAWEngine.ts \
  client/src/hooks/useMidiSequencer.ts \
  2>/dev/null | tail -1 | awk '{print $NF}' || echo 0)

echo "Total changed lines: $DIFF_LINES"
echo "Expected: < 100 lines total (most is new express.d.ts)"

if [[ $DIFF_LINES -gt 150 ]]; then
  echo "⚠ WARNING: Diff is larger than expected; review changes carefully"
fi
echo

# =============================================================================
# CHECK 8: Next step validation
# =============================================================================
echo "=== CHECK 8: Next Steps ==="

if [[ $TYPECHECK_EXIT -eq 0 ]] && [[ $FAILED -eq 0 ]]; then
  echo "✅ ALL CHECKS PASSED"
  echo
  echo "Ready to proceed:"
  echo "  1. Review changes: git diff"
  echo "  2. Commit: git commit -m 'fix: resolve 8 TypeScript errors'"
  echo "  3. Push: git push"
  echo "  4. Verify Railway deployment"
  exit 0
else
  echo "❌ CHECKS FAILED ($FAILED issues found)"
  echo
  echo "Required fixes:"
  echo "  1. Review error output above"
  echo "  2. Rerun fix-ts-errors-complete.sh"
  echo "  3. Run this script again"
  exit 1
fi
