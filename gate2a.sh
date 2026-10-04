#!/usr/bin/env bash

# ============================================================
# R3 DAW — GATE 2A TONE REACTIVATION
# QUADRUPLE-CHECK DIAGNOSTIC SUITE
# Evidence-First Protocol (WIRE.txt compliant)
# ============================================================

set -u

PROJECT_ROOT="$(cd ~/Projects/r3v4 2>/dev/null && pwd)" || {
  printf '\n❌ GUARD FAILED: ~/Projects/r3v4 not found\n'
  exit 1
}

TONE_RT="${PROJECT_ROOT}/client/src/audio/core/tone-runtime.ts"
BACKUP_DIR="${PROJECT_ROOT}/backups/gate-2a-diagnostic-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

printf '\n%s\n' '============================================================'
printf '%s\n' 'R3 DAW — GATE 2A TONE REACTIVATION DIAGNOSTIC'
printf '%s\n' 'QUADRUPLE-CHECK VERIFICATION SUITE'
printf '%s\n' '============================================================\n'

# ============================================================
# PHASE 1: FILE EXISTENCE & PERMISSIONS
# ============================================================

printf '📋 PHASE 1: FILE EXISTENCE & PERMISSIONS\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'

if [[ ! -f "$TONE_RT" ]]; then
  printf '❌ CRITICAL: File not found: %s\n' "$TONE_RT"
  printf '   Available audio files:\n'
  find "${PROJECT_ROOT}/client/src/audio" -name "*.ts" 2>/dev/null | head -20
  exit 1
fi

printf '✅ File exists: %s\n' "$TONE_RT"
printf '   Size: %s bytes\n' "$(wc -c < "$TONE_RT")"
printf '   Readable: %s\n' "$(test -r "$TONE_RT" && echo 'YES' || echo 'NO')"
printf '   Writable: %s\n' "$(test -w "$TONE_RT" && echo 'YES' || echo 'NO')"

# ============================================================
# PHASE 2: LOCATE TARGET PATTERNS
# ============================================================

printf '\n📋 PHASE 2: LOCATE TARGET PATTERNS\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'

# Search for the function
if grep -q "export function initializeToneFromGesture" "$TONE_RT"; then
  printf '✅ Found: export function initializeToneFromGesture()\n'
  FUNC_LINE=$(grep -n "export function initializeToneFromGesture" "$TONE_RT" | cut -d: -f1 | head -1)
  printf '   Location: Line %s\n' "$FUNC_LINE"
else
  printf '❌ NOT FOUND: export function initializeToneFromGesture()\n'
  printf '   Available functions:\n'
  grep -n "^export function\|^export const\|^function" "$TONE_RT" | head -10
fi

# Search for fast-path pattern
printf '\n🔍 Searching for fast-path patterns:\n'

if grep -q "if (runtime) return Promise.resolve(runtime)" "$TONE_RT"; then
  printf '✅ Found EXACT fast-path: if (runtime) return Promise.resolve(runtime)\n'
  PATTERN_LINE=$(grep -n "if (runtime) return Promise.resolve(runtime)" "$TONE_RT" | head -1 | cut -d: -f1)
  printf '   Line: %s\n' "$PATTERN_LINE"
elif grep -q "if (runtime)" "$TONE_RT"; then
  printf '⚠️  Found if (runtime) but different fast-path pattern\n'
  grep -n "if (runtime)" "$TONE_RT" | head -5
fi

# Search for initPromise pattern
if grep -q "if (initPromise) return initPromise" "$TONE_RT"; then
  printf '✅ Found: if (initPromise) return initPromise\n'
  grep -n "if (initPromise) return initPromise" "$TONE_RT" | head -1
fi

# ============================================================
# PHASE 3: CONTEXT EXTRACTION
# ============================================================

printf '\n📋 PHASE 3: FUNCTION CONTEXT EXTRACTION\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'

if [[ -n "${FUNC_LINE:-}" ]]; then
  printf '📝 Full function context (next 20 lines from line %s):\n' "$FUNC_LINE"
  printf '---\n'
  sed -n "${FUNC_LINE},$((FUNC_LINE + 20))p" "$TONE_RT"
  printf '---\n'
else
  printf '⚠️  Could not extract context (function line unknown)\n'
fi

# ============================================================
# PHASE 4: INTEGRATION POINT CHECK
# ============================================================

printf '\n📋 PHASE 4: INTEGRATION POINT CHECK\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'

printf '🔍 Checking for required integration points:\n\n'

# Check for getAudioContext
if grep -q "getAudioContext\|function getAudioContext" "$TONE_RT"; then
  printf '✅ getAudioContext is available\n'
  grep -n "getAudioContext" "$TONE_RT" | head -3
else
  printf '⚠️  getAudioContext NOT FOUND\n'
  printf '   Need to check if it\'s imported or defined elsewhere\n'
  grep -r "getAudioContext" "${PROJECT_ROOT}/client/src/audio/" 2>/dev/null | head -5 || printf '   (not found in audio directory)\n'
fi

# Check for runtime variable
if grep -q "let runtime\|const runtime\|var runtime" "$TONE_RT"; then
  printf '✅ runtime variable is declared\n'
  grep -n "runtime" "$TONE_RT" | head -3
fi

# ============================================================
# PHASE 5: BACKUP & REPORT
# ============================================================

printf '\n📋 PHASE 5: SAFETY BACKUP\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'

cp "$TONE_RT" "$BACKUP_DIR/tone-runtime.ts.original"
printf '✅ Backup created: %s/tone-runtime.ts.original\n' "$BACKUP_DIR"

# Save full file for analysis
cp "$TONE_RT" "$BACKUP_DIR/tone-runtime.ts.full"

# ============================================================
# SUMMARY
# ============================================================

printf '\n%s\n' '============================================================'
printf '%s\n' 'DIAGNOSTIC SUMMARY'
printf '%s\n' '============================================================\n'

printf '📁 Project Root: %s\n' "$PROJECT_ROOT"
printf '📝 Target File: %s\n' "$TONE_RT"
printf '💾 Backup Dir: %s\n' "$BACKUP_DIR"
printf '✅ Diagnostic Complete — Ready for next phase\n\n'

printf 'NEXT STEPS:\n'
printf '  1. Review Phase 2-4 output above\n'
printf '  2. Confirm actual fast-path pattern in your codebase\n'
printf '  3. Run: bash gate-2a-remediation.sh\n\n'
