#!/bin/bash

################################################################################
# R3 v4 CORS Fix — Production-Grade Option A (Corrected Sed-Based)
#
# WIRE.txt Protocol Compliance:
#   ✓ Read-before-write with temp file
#   ✓ Assert count == 1 for each change
#   ✓ Timestamped backups with verification
#   ✓ Error checking on EVERY sed operation
#   ✓ Validation after each step (no silent failures)
#   ✓ Multi-statement sed with proper anchoring
#   ✓ Diff preview before final apply
#
# Usage:
#   ./r3-cors-fix.sh              # Dry-run (default)
#   ./r3-cors-fix.sh --apply      # Apply changes
#   ./r3-cors-fix.sh --rollback   # Restore from backup
#
# Key Improvements:
#   • Each sed operation has error checking
#   • Temp file used for all changes (safe)
#   • Validation after EVERY modification
#   • Proper regex anchoring (no greedy matches)
#   • Clear error messages with line numbers
#   • Rollback capability with verification
################################################################################

set -o pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

TARGET_FILE="$HOME/Stable/server/index.ts"
BACKUP_DIR="$HOME/Stable/server/.backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/index.ts.bak_${TIMESTAMP}"
LATEST_BACKUP="$BACKUP_DIR/index.ts.bak_LATEST"
TEMP_FILE="/tmp/r3-index-${TIMESTAMP}.ts"

DRY_RUN=true
MODE="dry-run"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_section() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n${CYAN}$1${NC}\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

fail() {
  log_error "$1"
  exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# CORE FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

# Verify target file exists
verify_file() {
  if [ ! -f "$TARGET_FILE" ]; then
    fail "Target file not found: $TARGET_FILE"
  fi
  log_success "Target file exists: $TARGET_FILE"
}

# Create backup directory
ensure_backup_dir() {
  if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR" || fail "Failed to create backup directory"
    log_success "Created backup directory: $BACKUP_DIR"
  fi
}

# Create timestamped backup
create_backup() {
  cp "$TARGET_FILE" "$BACKUP_FILE" || fail "Failed to create backup"
  cp "$TARGET_FILE" "$LATEST_BACKUP" || fail "Failed to create latest backup"
  log_success "Backup created: $BACKUP_FILE"
}

# Assert pattern count in file
assert_count() {
  local pattern="$1"
  local expected="$2"
  local file="$3"
  
  local actual=$(grep -c "$pattern" "$file" 2>/dev/null || echo "0")
  if [ "$actual" -ne "$expected" ]; then
    log_error "Assertion failed: pattern '$pattern' found $actual times (expected $expected)"
    return 1
  fi
  log_success "Assert passed: pattern found exactly $expected time(s)"
  return 0
}

# Copy to temp file for modifications
prepare_temp_file() {
  cp "$TARGET_FILE" "$TEMP_FILE" || fail "Failed to create temp file"
  log_success "Working copy created: $TEMP_FILE"
}

# Validate sed operation
validate_sed() {
  local operation="$1"
  local file="$2"
  local pattern="$3"
  
  if ! grep -q "$pattern" "$file"; then
    log_error "Validation failed: pattern not found after $operation"
    return 1
  fi
  log_success "Validated: $operation"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Replace PORT + CLIENT_URL + allowedOrigins
# ─────────────────────────────────────────────────────────────────────────────

replace_constants() {
  log_section "STEP 1: Replace Constants (PORT + CLIENT_URL + allowedOrigins)"
  
  # Verify old pattern exists
  if ! assert_count "const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173'" 1 "$TEMP_FILE"; then
    fail "Precondition failed: old CLIENT_URL not found"
  fi
  
  if [ "$DRY_RUN" = true ]; then
    log_warn "[DRY-RUN] Would replace constants section"
    grep -n "const CLIENT_URL = process.env.CLIENT_URL" "$TEMP_FILE"
    return 0
  fi
  
  log_info "Replacing CLIENT_URL constant..."
  
  # Use sed to replace the old line
  sed -i "/^const CLIENT_URL = process.env.CLIENT_URL ?? 'http:\/\/localhost:5173';$/c\\
const PORT = parseInt(process.env.PORT ?? '3000', 10);\
\
\/\/ Parse CLIENT_URL into array of allowed origins\
\/\/ Format: comma-separated list (e.g., \"http:\/\/localhost:5173,http:\/\/localhost:5174,http:\/\/localhost:5177\")\
\/\/ Filters out empty strings to prevent malformed env var attacks (defense-in-depth)\
const CLIENT_URL = process.env.CLIENT_URL ?? 'http:\/\/localhost:5173,http:\/\/localhost:5174,http:\/\/localhost:5177';\
const allowedOrigins = CLIENT_URL.split(',')\
  .map(url => url.trim())\
  .filter(url => url.length > 0);" "$TEMP_FILE" || fail "sed operation failed"
  
  # Validate result
  if validate_sed "Replace constants" "$TEMP_FILE" "const PORT = parseInt"; then
    log_success "Step 1 complete: Constants replaced"
    return 0
  else
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Remove broken cors() call (lines 68-76 in original)
# ─────────────────────────────────────────────────────────────────────────────

remove_broken_cors() {
  log_section "STEP 2: Remove Broken CORS Call"
  
  # Check if broken pattern exists
  if grep -q "^cors({$" "$TEMP_FILE" && grep -q "^  \.\.\.$" "$TEMP_FILE"; then
    if [ "$DRY_RUN" = true ]; then
      log_warn "[DRY-RUN] Would remove broken cors() block"
      grep -n "cors({" "$TEMP_FILE" | head -1
      return 0
    fi
    
    log_info "Removing broken cors() call..."
    
    # Remove lines from cors({ to closing ...
    sed -i '/^cors({$/,/^  \.\.\.$/d' "$TEMP_FILE" || fail "sed delete failed"
    
    # Validate it's gone
    if ! grep -q "^cors({$" "$TEMP_FILE"; then
      log_success "Step 2 complete: Broken cors() removed"
      return 0
    else
      fail "Step 2 failed: Broken cors() still present"
    fi
  else
    log_info "Broken cors() not found (may already be removed)"
    return 0
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Replace CORS middleware origin with proper function
# ─────────────────────────────────────────────────────────────────────────────

replace_cors_middleware() {
  log_section "STEP 3: Replace CORS Middleware Origin Function"
  
  # Verify old pattern
  if ! grep -q "origin:.*CLIENT_URL" "$TEMP_FILE"; then
    log_warn "Old CORS origin pattern not found (may already be updated)"
    return 0
  fi
  
  if ! assert_count "origin:.*CLIENT_URL" 1 "$TEMP_FILE"; then
    fail "Assertion failed: found multiple 'origin: CLIENT_URL' lines"
  fi
  
  if [ "$DRY_RUN" = true ]; then
    log_warn "[DRY-RUN] Would replace CORS origin function"
    grep -n "origin:.*CLIENT_URL" "$TEMP_FILE"
    return 0
  fi
  
  log_info "Replacing CORS origin function..."
  
  # Replace the origin line with the new function
  sed -i '/origin:.*CLIENT_URL,$/c\
    origin: (origin, cb) => {\
      \/\/ Allow requests without Origin header (same-origin requests)\
      if (!origin) {\
        cb(null, true);\
        return;\
      }\
      \/\/ Allow requests from whitelisted origins\
      if (allowedOrigins.includes(origin)) {\
        cb(null, true);\
        return;\
      }\
      \/\/ Reject requests from non-whitelisted origins\
      cb(new Error(`CORS not allowed: ${origin}`));\
    },' "$TEMP_FILE" || fail "sed replacement failed"
  
  # Validate
  if validate_sed "Replace CORS origin" "$TEMP_FILE" "origin: (origin, cb) =>"; then
    log_success "Step 3 complete: CORS middleware updated"
    return 0
  else
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Add CORS origins to startup log
# ─────────────────────────────────────────────────────────────────────────────

add_cors_log() {
  log_section "STEP 4: Add CORS Origins to Startup Log"
  
  # Verify line exists
  if ! grep -q "logger.info.*Server listening.*port: PORT" "$TEMP_FILE"; then
    log_warn "Startup log line not found (may already be updated)"
    return 0
  fi
  
  if ! assert_count "logger.info.*Server listening.*port: PORT" 1 "$TEMP_FILE"; then
    fail "Assertion failed: found multiple startup log lines"
  fi
  
  if [ "$DRY_RUN" = true ]; then
    log_warn "[DRY-RUN] Would add CORS origins log"
    grep -n "logger.info.*Server listening" "$TEMP_FILE"
    return 0
  fi
  
  log_info "Adding CORS origins startup log..."
  
  # Insert new log line after the Server listening log
  sed -i "/logger.info.*Server listening.*port: PORT.*);$/a\\
  logger.info('[R3 v4] CORS allowed origins:', { origins: allowedOrigins });" "$TEMP_FILE" || fail "sed insertion failed"
  
  # Validate
  if validate_sed "Add CORS log" "$TEMP_FILE" "CORS allowed origins"; then
    log_success "Step 4 complete: CORS startup log added"
    return 0
  else
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Verify all changes in temp file
# ─────────────────────────────────────────────────────────────────────────────

verify_all_changes() {
  log_section "STEP 5: Verify All Changes"
  
  local checks_passed=0
  local checks_total=4
  
  # Check 1: PORT constant
  if grep -q "^const PORT = parseInt" "$TEMP_FILE"; then
    log_success "✓ PORT constant defined"
    ((checks_passed++))
  else
    log_error "✗ PORT constant not found"
  fi
  
  # Check 2: allowedOrigins with filter
  if grep -q "\.filter(url => url.length > 0)" "$TEMP_FILE"; then
    log_success "✓ allowedOrigins filter present"
    ((checks_passed++))
  else
    log_error "✗ allowedOrigins filter not found"
  fi
  
  # Check 3: CORS origin function
  if grep -q "origin: (origin, cb) =>" "$TEMP_FILE"; then
    log_success "✓ CORS origin function implemented"
    ((checks_passed++))
  else
    log_error "✗ CORS origin function not found"
  fi
  
  # Check 4: CORS origins startup log
  if grep -q "CORS allowed origins" "$TEMP_FILE"; then
    log_success "✓ CORS origins startup log added"
    ((checks_passed++))
  else
    log_error "✗ CORS origins startup log not found"
  fi
  
  log_info "Verification: $checks_passed / $checks_total checks passed"
  
  if [ "$checks_passed" -eq "$checks_total" ]; then
    log_success "All changes verified successfully!"
    return 0
  else
    fail "Verification failed: $checks_passed of $checks_total checks passed"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: Show diff and apply
# ─────────────────────────────────────────────────────────────────────────────

show_diff() {
  log_section "Differences (Original vs Modified)"
  
  if diff -q "$TARGET_FILE" "$TEMP_FILE" &>/dev/null; then
    log_warn "No differences found (file unchanged)"
    return 1
  fi
  
  diff -u "$TARGET_FILE" "$TEMP_FILE" | head -200
  log_info "Full diff: diff -u $TARGET_FILE $TEMP_FILE"
  return 0
}

apply_changes() {
  log_section "STEP 6: Apply Changes to Target File"
  
  if [ "$DRY_RUN" = true ]; then
    log_warn "[DRY-RUN] Changes NOT applied to target file"
    return 0
  fi
  
  log_info "Applying changes to target file..."
  cp "$TEMP_FILE" "$TARGET_FILE" || fail "Failed to apply changes"
  log_success "Changes applied: $TARGET_FILE"
  
  # Verify file is valid TypeScript (basic check)
  if ! grep -q "export { app, httpServer }" "$TARGET_FILE"; then
    fail "File validation failed: exports missing"
  fi
  
  log_success "File validation passed"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# ROLLBACK
# ─────────────────────────────────────────────────────────────────────────────

do_rollback() {
  log_section "ROLLBACK MODE"
  
  if [ ! -f "$LATEST_BACKUP" ]; then
    fail "No backup found: $LATEST_BACKUP"
  fi
  
  log_warn "Rolling back to: $LATEST_BACKUP"
  cp "$LATEST_BACKUP" "$TARGET_FILE" || fail "Rollback failed"
  log_success "Rollback complete!"
  
  # Verify
  if grep -q "export { app, httpServer }" "$TARGET_FILE"; then
    log_success "Rollback validated successfully"
  else
    fail "Rollback validation failed"
  fi
  
  exit 0
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ─────────────────────────────────────────────────────────────────────────────

main() {
  # Parse arguments
  while [ $# -gt 0 ]; do
    case "$1" in
      --apply)
        DRY_RUN=false
        MODE="apply"
        ;;
      --dry-run)
        DRY_RUN=true
        MODE="dry-run"
        ;;
      --rollback)
        do_rollback
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
    shift
  done
  
  # Banner
  log_section "R3 v4 CORS Fix — Production-Grade Sed-Based (Option A)"
  
  if [ "$DRY_RUN" = true ]; then
    log_warn "DRY-RUN MODE: No files will be modified"
    log_info "Run with --apply to execute changes"
  else
    log_warn "APPLY MODE: Files WILL be modified"
    read -p "Continue? (type 'yes' to confirm): " -r CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
      log_warn "Cancelled by user"
      exit 0
    fi
  fi
  
  echo ""
  
  # Execute
  verify_file
  ensure_backup_dir
  prepare_temp_file
  
  if [ "$DRY_RUN" = false ]; then
    create_backup
  fi
  
  replace_constants || fail "Step 1 failed"
  remove_broken_cors || fail "Step 2 failed"
  replace_cors_middleware || fail "Step 3 failed"
  add_cors_log || fail "Step 4 failed"
  verify_all_changes || fail "Step 5 failed"
  show_diff || log_warn "No differences to show"
  apply_changes || fail "Step 6 failed"
  
  # Final summary
  log_section "SUCCESS — R3 v4 CORS Fix Complete"
  
  if [ "$DRY_RUN" = false ]; then
    log_success "File updated: $TARGET_FILE"
    log_success "Backup saved: $LATEST_BACKUP"
    log_info "Rollback: ./r3-cors-fix.sh --rollback"
    log_info ""
    log_info "Watch R3 v4 terminal for:"
    log_info "  [server] INFO [R3 v4] CORS allowed origins: { origins: [ ... ] }"
  else
    log_info "Dry-run complete. Run with --apply to execute."
  fi
  
  # Cleanup
  rm -f "$TEMP_FILE"
}

main "$@"
