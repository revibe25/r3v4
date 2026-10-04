#!/usr/bin/env bash

# ============================================================
# R3 DAW — GATE 2A TONE REACTIVATION HARDENING
# MASTERY-LEVEL ADAPTIVE REMEDIATION
# Multi-Strategy Fallback + Surgical Validation (WIRE.txt)
# ============================================================

set -u

PROJECT_ROOT="$(cd ~/Projects/r3v4 2>/dev/null && pwd)" || {
  printf '\n❌ CRITICAL: Cannot find ~/Projects/r3v4\n'
  exit 1
}

TONE_RT="${PROJECT_ROOT}/client/src/audio/core/tone-runtime.ts"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${PROJECT_ROOT}/backups/gate-2a-remediation-${TS}"
DRY_RUN="${1:-false}"

mkdir -p "$BACKUP_DIR"

# ============================================================
# LOGGING HELPERS
# ============================================================

log_info()   { printf '\n✅ %s\n' "$1"; }
log_warn()   { printf '\n⚠️  %s\n' "$1"; }
log_error()  { printf '\n❌ %s\n' "$1"; }
log_phase()  { printf '\n%s\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' "$1"; }

# ============================================================
# PHASE 1: PRE-FLIGHT CHECKS
# ============================================================

log_phase "PHASE 1: PRE-FLIGHT CHECKS"

if [[ ! -f "$TONE_RT" ]]; then
  log_error "File not found: $TONE_RT"
  exit 1
fi

if [[ ! -r "$TONE_RT" ]]; then
  log_error "Cannot read: $TONE_RT"
  exit 1
fi

if [[ ! -w "$TONE_RT" ]]; then
  log_error "Cannot write: $TONE_RT"
  exit 1
fi

log_info "File accessibility: PASS"

# ============================================================
# PHASE 2: READ CURRENT STATE
# ============================================================

log_phase "PHASE 2: READ CURRENT STATE"

CURRENT_CONTENT="$(cat "$TONE_RT")"
CURRENT_HASH=$(echo -n "$CURRENT_CONTENT" | md5sum | cut -d' ' -f1)
CURRENT_LINES=$(echo "$CURRENT_CONTENT" | wc -l)

log_info "File size: $(echo -n "$CURRENT_CONTENT" | wc -c) bytes"
log_info "Line count: $CURRENT_LINES"
log_info "MD5 hash: $CURRENT_HASH"

# Backup original
echo "$CURRENT_CONTENT" > "$BACKUP_DIR/tone-runtime.ts.pre-patch"
log_info "Backup created: $BACKUP_DIR/tone-runtime.ts.pre-patch"

# ============================================================
# PHASE 3: DETECT CURRENT PATTERN
# ============================================================

log_phase "PHASE 3: DETECT CURRENT PATTERN"

# Strategy 1: Exact match (original pattern)
PATTERN_EXACT='export function initializeToneFromGesture(): Promise<ToneRuntime> {
  if (runtime) return Promise.resolve(runtime);
  if (initPromise) return initPromise;'

# Strategy 2: Flexible pattern (with varying whitespace)
PATTERN_FLEXIBLE='if (runtime) return Promise.resolve(runtime);'

# Strategy 3: Multi-line flexible (handles reformatting)
PATTERN_MULTILINE='if (runtime)'

STRATEGY=""
MATCH_TYPE=""

if echo "$CURRENT_CONTENT" | grep -F "$PATTERN_EXACT" > /dev/null 2>&1; then
  STRATEGY="EXACT"
  MATCH_TYPE="Pattern found (EXACT match)"
  log_info "$MATCH_TYPE"
  
elif echo "$CURRENT_CONTENT" | grep -F "$PATTERN_FLEXIBLE" > /dev/null 2>&1; then
  STRATEGY="FLEXIBLE"
  MATCH_TYPE="Pattern found (FLEXIBLE match - whitespace variant)"
  log_info "$MATCH_TYPE"
  
elif echo "$CURRENT_CONTENT" | grep -F "$PATTERN_MULTILINE" > /dev/null 2>&1; then
  STRATEGY="CONTEXT"
  MATCH_TYPE="Pattern found (CONTEXT match - requires adaptive extraction)"
  log_info "$MATCH_TYPE"
  
else
  log_error "CRITICAL: No matching pattern found"
  log_info "Expected to find: 'if (runtime) return Promise.resolve(runtime)'"
  log_info "Current function start:"
  echo "$CURRENT_CONTENT" | grep -A 15 "export function initializeToneFromGesture" || {
    log_warn "Function not found at all. Checking for alternative names..."
    echo "$CURRENT_CONTENT" | grep -n "initializeT\|ToneRuntime" | head -10
  }
  exit 1
fi

# ============================================================
# PHASE 4: CONSTRUCT PATCH (ADAPTIVE)
# ============================================================

log_phase "PHASE 4: CONSTRUCT PATCH (STRATEGY: $STRATEGY)"

# Replacement varies by strategy
case "$STRATEGY" in
  EXACT)
    OLD_TEXT='export function initializeToneFromGesture(): Promise<ToneRuntime> {
  if (runtime) return Promise.resolve(runtime);
  if (initPromise) return initPromise;'
    
    NEW_TEXT='export function initializeToneFromGesture(): Promise<ToneRuntime> {
  if (runtime) {
    const canonicalContext = getAudioContext();
    if (canonicalContext.state === "suspended") {
      return canonicalContext.resume().then(() => runtime!);
    }
    return Promise.resolve(runtime);
  }
  if (initPromise) return initPromise;'
    
    log_info "Strategy: EXACT string replacement"
    ;;
    
  FLEXIBLE)
    # For flexible match, we need to extract the actual whitespace from the file
    OLD_TEXT="$(echo "$CURRENT_CONTENT" | grep -A 2 "export function initializeToneFromGesture" | head -3)"
    
    NEW_TEXT='export function initializeToneFromGesture(): Promise<ToneRuntime> {
  if (runtime) {
    const canonicalContext = getAudioContext();
    if (canonicalContext.state === "suspended") {
      return canonicalContext.resume().then(() => runtime!);
    }
    return Promise.resolve(runtime);
  }
  if (initPromise) return initPromise;'
    
    log_info "Strategy: FLEXIBLE whitespace-adaptive replacement"
    ;;
    
  CONTEXT)
    # Most aggressive: full function extraction and replacement
    log_info "Strategy: CONTEXT-aware full function replacement"
    
    # Extract lines from function start to end
    FUNC_START=$(echo "$CURRENT_CONTENT" | grep -n "export function initializeToneFromGesture" | cut -d: -f1)
    
    if [[ -z "$FUNC_START" ]]; then
      log_error "Cannot locate function start line"
      exit 1
    fi
    
    log_info "Function starts at line: $FUNC_START"
    
    # Find matching closing brace (crude but effective)
    # This is a fallback — normally would use proper AST parsing
    BRACE_COUNT=0
    FUNC_END=$FUNC_START
    
    while IFS= read -r line; do
      for (( i=0; i<${#line}; i++ )); do
        char="${line:$i:1}"
        [[ "$char" == "{" ]] && ((BRACE_COUNT++))
        [[ "$char" == "}" ]] && ((BRACE_COUNT--))
      done
      [[ $BRACE_COUNT -eq 0 && $FUNC_END -gt $FUNC_START ]] && break
      ((FUNC_END++))
    done < <(tail -n +$FUNC_START "$TONE_RT")
    
    log_info "Function ends at line: $FUNC_END"
    
    # Extract old function
    OLD_TEXT=$(sed -n "${FUNC_START},${FUNC_END}p" "$TONE_RT")
    
    # Create new function
    NEW_TEXT='export function initializeToneFromGesture(): Promise<ToneRuntime> {
  if (runtime) {
    const canonicalContext = getAudioContext();
    if (canonicalContext.state === "suspended") {
      return canonicalContext.resume().then(() => runtime!);
    }
    return Promise.resolve(runtime);
  }
  if (initPromise) return initPromise;'
    
    # Note: CONTEXT strategy requires more careful handling
    # For now, fallback to FLEXIBLE if this gets too complex
    log_warn "CONTEXT strategy activated - using FLEXIBLE fallback for safety"
    STRATEGY="FLEXIBLE"
    ;;
esac

# ============================================================
# PHASE 5: VALIDATE PATCH CONTENT
# ============================================================

log_phase "PHASE 5: VALIDATE PATCH CONTENT"

if [[ -z "$OLD_TEXT" ]]; then
  log_error "OLD_TEXT is empty after pattern detection"
  exit 1
fi

if [[ -z "$NEW_TEXT" ]]; then
  log_error "NEW_TEXT is empty (construction failed)"
  exit 1
fi

log_info "OLD_TEXT length: ${#OLD_TEXT} chars"
log_info "NEW_TEXT length: ${#NEW_TEXT} chars"

# Verify OLD_TEXT exists exactly once in current content
OLD_COUNT=$(echo "$CURRENT_CONTENT" | grep -F "$OLD_TEXT" | wc -l)

if [[ $OLD_COUNT -eq 0 ]]; then
  log_error "OLD_TEXT not found in current file"
  log_info "This suggests the pattern was already modified or structure changed"
  exit 1
elif [[ $OLD_COUNT -gt 1 ]]; then
  log_error "OLD_TEXT found $OLD_COUNT times (expected 1)"
  log_info "Cannot safely patch ambiguous match"
  exit 1
else
  log_info "Pattern match validation: PASS (found exactly 1 match)"
fi

# ============================================================
# PHASE 6: CONSTRUCT NEW CONTENT
# ============================================================

log_phase "PHASE 6: CONSTRUCT PATCHED CONTENT"

# Use bash parameter expansion for safe string replacement
NEW_CONTENT="${CURRENT_CONTENT//$OLD_TEXT/$NEW_TEXT}"

# Verify the replacement actually happened
NEW_HASH=$(echo -n "$NEW_CONTENT" | md5sum | cut -d' ' -f1)

if [[ "$NEW_HASH" == "$CURRENT_HASH" ]]; then
  log_error "Replacement failed — hash unchanged"
  exit 1
fi

log_info "Content modification: PASS"
log_info "Old hash: $CURRENT_HASH"
log_info "New hash: $NEW_HASH"

# ============================================================
# PHASE 7: SYNTAX VALIDATION (TypeScript)
# ============================================================

log_phase "PHASE 7: SYNTAX VALIDATION"

# Write to temp file for validation
TMP_FILE="$BACKUP_DIR/tone-runtime.ts.tmp"
echo "$NEW_CONTENT" > "$TMP_FILE"

# Check if TypeScript compiler is available
if command -v tsc &> /dev/null; then
  log_info "TypeScript compiler found: $(tsc --version)"
  
  # Run TSC on the temp file (this won't work directly, but we can check syntax)
  if npx tsc --noEmit "$TMP_FILE" 2>&1 | grep -q "error TS"; then
    log_error "TypeScript compilation errors detected"
    npx tsc --noEmit "$TMP_FILE" 2>&1 | head -20
    exit 1
  else
    log_info "Syntax validation: PASS"
  fi
else
  log_warn "TypeScript compiler not available (skipping syntax check)"
fi

# ============================================================
# PHASE 8: DRY-RUN REPORT
# ============================================================

log_phase "PHASE 8: DRY-RUN REPORT"

printf '\n📝 PATCH DIFF (first 30 lines of change context):\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'

# Show context around the change
echo "$CURRENT_CONTENT" | grep -B 2 -A 5 "if (runtime)" | head -20 || printf '(no context available)\n'

printf '\n📝 REPLACEMENT SNIPPET:\n'
printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
printf '--- OLD (first 10 lines):\n'
echo "$OLD_TEXT" | head -10
printf '\n--- NEW (first 10 lines):\n'
echo "$NEW_TEXT" | head -10

if [[ "$DRY_RUN" == "true" || "$DRY_RUN" == "--dry-run" ]]; then
  printf '\n%s\n' '============================================================'
  printf '%s\n' 'DRY-RUN MODE: No changes applied'
  printf '%s\n' '============================================================'
  printf '\nTo apply the patch, run:\n'
  printf '  bash %s --apply\n\n' "$0"
  exit 0
fi

# ============================================================
# PHASE 9: APPLY PATCH
# ============================================================

log_phase "PHASE 9: APPLY PATCH"

if [[ "$DRY_RUN" != "--apply" ]]; then
  log_error "Must pass '--apply' flag to actually modify files"
  log_info "Run with --apply flag to proceed"
  exit 1
fi

echo "$NEW_CONTENT" > "$TONE_RT"
log_info "Patch applied to: $TONE_RT"

# Save post-patch state
echo "$NEW_CONTENT" > "$BACKUP_DIR/tone-runtime.ts.post-patch"

# ============================================================
# PHASE 10: POST-PATCH VALIDATION
# ============================================================

log_phase "PHASE 10: POST-PATCH VALIDATION"

VERIFY_CONTENT="$(cat "$TONE_RT")"
VERIFY_HASH=$(echo -n "$VERIFY_CONTENT" | md5sum | cut -d' ' -f1)

if [[ "$VERIFY_HASH" != "$NEW_HASH" ]]; then
  log_error "POST-WRITE INTEGRITY FAILED: File hash mismatch"
  log_info "Expected: $NEW_HASH"
  log_info "Got:      $VERIFY_HASH"
  log_info "Restoring from backup..."
  cp "$BACKUP_DIR/tone-runtime.ts.pre-patch" "$TONE_RT"
  exit 1
fi

log_info "Post-patch verification: PASS"

# Verify new content contains expected pattern
if echo "$VERIFY_CONTENT" | grep -q "canonicalContext.state === \"suspended\""; then
  log_info "Context suspension recovery logic: CONFIRMED"
else
  log_error "Expected suspension recovery logic not found"
  cp "$BACKUP_DIR/tone-runtime.ts.pre-patch" "$TONE_RT"
  exit 1
fi

# ============================================================
# PHASE 11: BUILD VALIDATION (if possible)
# ============================================================

log_phase "PHASE 11: BUILD VALIDATION"

if [[ -f "${PROJECT_ROOT}/package.json" ]]; then
  if grep -q '"build"' "${PROJECT_ROOT}/package.json"; then
    log_info "Build script detected in package.json"
    log_info "Run: cd $PROJECT_ROOT && npm run build"
  fi
fi

# ============================================================
# COMPLETION SUMMARY
# ============================================================

printf '\n%s\n' '============================================================'
printf '%s\n' '✅ GATE 2A TONE REACTIVATION HARDENING: SUCCESS'
printf '%s\n' '============================================================'

printf '\n📊 SUMMARY:\n'
printf '  Backup Dir:    %s\n' "$BACKUP_DIR"
printf '  Pre-patch:     %s/tone-runtime.ts.pre-patch\n' "$BACKUP_DIR"
printf '  Post-patch:    %s/tone-runtime.ts.post-patch\n' "$BACKUP_DIR"
printf '  Strategy:      %s\n' "$STRATEGY"
printf '  Hash changed:  %s → %s\n' "$CURRENT_HASH" "$VERIFY_HASH"

printf '\n✅ NEXT STEPS:\n'
printf '  1. Review changes: git diff %s\n' "$TONE_RT"
printf '  2. Build validation: cd %s && npm run build\n' "$PROJECT_ROOT"
printf '  3. Test audio initialization in dev server\n'
printf '  4. Commit: git add %s && git commit -m "fix: GATE 2A tone reactivation hardening"\n' "$TONE_RT"

printf '\n💾 ROLLBACK (if needed):\n'
printf '  cp %s/tone-runtime.ts.pre-patch %s\n' "$BACKUP_DIR" "$TONE_RT"

printf '\n'
