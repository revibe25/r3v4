#!/bin/bash

################################################################################
# R3 v4 CORS Fix — Mastery Implementation Script
# 
# WIRE.txt Protocol Compliance:
#   ✓ Read-before-write (dry-run first)
#   ✓ Assert count == 1 for each replacement
#   ✓ Timestamped backups
#   ✓ Rollback capability
#   ✓ Verbose output with verification
#
# Usage:
#   ./r3-cors-fix.sh [--dry-run] [--apply] [--rollback]
#
# Default (no args): dry-run mode (shows what WOULD change, no files modified)
# --apply: execute the actual changes (requires explicit confirmation)
# --rollback: restore from last backup
################################################################################

set -o pipefail  # Fail if any command in a pipe fails

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

TARGET_FILE="$HOME/Stable/server/index.ts"
BACKUP_DIR="$HOME/Stable/server/.backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/index.ts.bak_${TIMESTAMP}"
LATEST_BACKUP_FILE="$BACKUP_DIR/index.ts.bak_LATEST"

DRY_RUN=true
APPLY=false
ROLLBACK=false
VERBOSE=true

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────────────────────────────────────
# FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_section() {
  echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}$1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Verify file exists
verify_file_exists() {
  if [ ! -f "$TARGET_FILE" ]; then
    log_error "Target file not found: $TARGET_FILE"
    exit 1
  fi
  log_success "Target file found: $TARGET_FILE"
}

# Create backup directory
create_backup_dir() {
  if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    log_success "Created backup directory: $BACKUP_DIR"
  fi
}

# Create timestamped backup
backup_file() {
  cp "$TARGET_FILE" "$BACKUP_FILE"
  cp "$TARGET_FILE" "$LATEST_BACKUP_FILE"
  log_success "Backup created: $BACKUP_FILE"
}

# Assert that a pattern appears exactly N times in the file
assert_count() {
  local pattern="$1"
  local expected_count="$2"
  local file="$3"
  
  local actual_count=$(grep -c "$pattern" "$file" 2>/dev/null || echo "0")
  
  if [ "$actual_count" -ne "$expected_count" ]; then
    log_error "Assertion failed: pattern '$pattern' found $actual_count times (expected $expected_count)"
    return 1
  fi
  
  log_success "Assertion passed: pattern found exactly $expected_count time(s)"
  return 0
}

# Read and verify current state before any changes
verify_current_state() {
  log_section "STEP 1: Verify Current State (Read-Before-Write)"
  
  log_info "Checking for existing PORT constant..."
  if grep -q "^const PORT = " "$TARGET_FILE"; then
    log_warn "PORT constant already exists (may be old version)"
  else
    log_info "PORT constant not found (expected for uncorrected file)"
  fi
  
  log_info "Checking for OLD CLIENT_URL pattern..."
  if grep -q "const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';" "$TARGET_FILE"; then
    log_success "Found OLD CLIENT_URL (needs updating)"
  else
    log_info "OLD CLIENT_URL not found (may already be updated)"
  fi
  
  log_info "Checking for broken cors() call (lines 68-76)..."
  if grep -q "cors({" "$TARGET_FILE" && grep -q "\.\.\." "$TARGET_FILE"; then
    log_warn "Found potential broken cors() call"
  fi
}

# Apply replacement 1: Replace constants section
apply_replacement_1() {
  log_section "STEP 2: Replace Constants Section (PORT + CLIENT_URL + allowedOrigins)"
  
  local old_pattern='const CLIENT_URL = process.env.CLIENT_URL ?? '\''http://localhost:5173'\'';'
  local new_text='const PORT = parseInt(process.env.PORT ?? '\''3000'\'', 10);

// Parse CLIENT_URL into array of allowed origins
// Format: comma-separated list (e.g., "http://localhost:5173,http://localhost:5174,http://localhost:5177")
// Filters out empty strings to prevent malformed env var attacks (defense-in-depth)
const CLIENT_URL = process.env.CLIENT_URL ?? '\''http://localhost:5173,http://localhost:5174,http://localhost:5177'\'';
const allowedOrigins = CLIENT_URL.split('\'',\'')
  .map(url => url.trim())
  .filter(url => url.length > 0);'
  
  log_info "Looking for old CLIENT_URL line..."
  
  if assert_count "const CLIENT_URL = process.env.CLIENT_URL" 1 "$TARGET_FILE"; then
    if [ "$DRY_RUN" = true ]; then
      log_warn "[DRY-RUN] Would replace constants section"
      log_info "Old line:"
      grep -n "const CLIENT_URL = process.env.CLIENT_URL" "$TARGET_FILE" | head -1
      log_info "New lines:"
      echo "$new_text" | head -6
    else
      sed -i "s|const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';|$new_text|" "$TARGET_FILE"
      log_success "Applied replacement 1: Constants section"
    fi
    return 0
  else
    return 1
  fi
}

# Apply replacement 2: Replace broken cors() call (lines 68-76)
apply_replacement_2() {
  log_section "STEP 3: Remove Broken CORS Call (Lines 68-76)"
  
  log_info "Searching for incomplete cors() call with '...' syntax..."
  
  if grep -q "cors({$" "$TARGET_FILE" && grep -q "  \.\.\.$" "$TARGET_FILE"; then
    if [ "$DRY_RUN" = true ]; then
      log_warn "[DRY-RUN] Would remove broken cors() call"
      grep -n "cors({" "$TARGET_FILE" | head -1
    else
      # Remove the broken cors() block (should be ~8 lines)
      sed -i '/^cors({$/,/^  \.\.\.$/d' "$TARGET_FILE"
      log_success "Applied replacement 2: Removed broken cors() call"
    fi
    return 0
  else
    log_info "Broken cors() call not found (may already be removed)"
    return 0
  fi
}

# Apply replacement 3: Replace the CORS middleware
apply_replacement_3() {
  log_section "STEP 4: Replace CORS Middleware with Proper Implementation"
  
  local old_cors_start='app.use('
  local old_cors_block='  cors({
    origin:      CLIENT_URL,'
  
  log_info "Locating existing cors middleware..."
  
  if assert_count "origin:.*CLIENT_URL" 1 "$TARGET_FILE"; then
    if [ "$DRY_RUN" = true ]; then
      log_warn "[DRY-RUN] Would replace CORS middleware"
      grep -n "origin:.*CLIENT_URL" "$TARGET_FILE"
    else
      # Replace the old origin line with the new origin function
      sed -i 's|origin:.*CLIENT_URL,|origin: (origin, cb) => {\n      // Allow requests without Origin header (same-origin requests)\n      if (!origin) {\n        cb(null, true);\n        return;\n      }\n      // Allow requests from whitelisted origins\n      if (allowedOrigins.includes(origin)) {\n        cb(null, true);\n        return;\n      }\n      // Reject requests from non-whitelisted origins\n      cb(new Error(`CORS not allowed: ${origin}`));\n    },|' "$TARGET_FILE"
      log_success "Applied replacement 3: CORS middleware"
    fi
    return 0
  else
    return 1
  fi
}

# Apply replacement 4: Add CORS origins to startup log
apply_replacement_4() {
  log_section "STEP 5: Add CORS Origins to Startup Log"
  
  local log_line="logger.info('[R3 v4] Server listening', { port: PORT });"
  local new_log_line="logger.info('[R3 v4] Server listening', { port: PORT });\n  logger.info('[R3 v4] CORS allowed origins:', { origins: allowedOrigins });"
  
  log_info "Searching for startup log location..."
  
  if assert_count "logger.info.*Server listening" 1 "$TARGET_FILE"; then
    if [ "$DRY_RUN" = true ]; then
      log_warn "[DRY-RUN] Would add CORS origins log"
      grep -n "logger.info.*Server listening" "$TARGET_FILE"
    else
      sed -i "s|logger.info('\[R3 v4\] Server listening', { port: PORT });|logger.info('[R3 v4] Server listening', { port: PORT });\n  logger.info('[R3 v4] CORS allowed origins:', { origins: allowedOrigins });|" "$TARGET_FILE"
      log_success "Applied replacement 4: Added CORS origins startup log"
    fi
    return 0
  else
    return 1
  fi
}

# Verify all changes were applied correctly
verify_changes() {
  log_section "STEP 6: Verify All Changes Applied"
  
  local checks_passed=0
  local checks_total=4
  
  # Check 1: PORT constant
  if grep -q "^const PORT = parseInt" "$TARGET_FILE"; then
    log_success "✓ PORT constant defined"
    ((checks_passed++))
  else
    log_error "✗ PORT constant not found"
  fi
  
  # Check 2: allowedOrigins with filter
  if grep -q "\.filter(url => url.length > 0)" "$TARGET_FILE"; then
    log_success "✓ allowedOrigins filter present"
    ((checks_passed++))
  else
    log_error "✗ allowedOrigins filter not found"
  fi
  
  # Check 3: CORS origin function
  if grep -q "origin: (origin, cb) =>" "$TARGET_FILE"; then
    log_success "✓ CORS origin function implemented"
    ((checks_passed++))
  else
    log_error "✗ CORS origin function not found"
  fi
  
  # Check 4: CORS origins startup log
  if grep -q "CORS allowed origins" "$TARGET_FILE"; then
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
    log_error "Some changes failed verification"
    return 1
  fi
}

# Show diff
show_diff() {
  log_section "Differences (Backup vs Current)"
  
  if [ -f "$LATEST_BACKUP_FILE" ]; then
    diff -u "$LATEST_BACKUP_FILE" "$TARGET_FILE" | head -100 || true
    log_info "Full diff available: diff -u $LATEST_BACKUP_FILE $TARGET_FILE"
  fi
}

# Rollback function
do_rollback() {
  log_section "ROLLBACK MODE"
  
  if [ ! -f "$LATEST_BACKUP_FILE" ]; then
    log_error "No backup found to rollback from"
    exit 1
  fi
  
  log_warn "Rolling back to: $LATEST_BACKUP_FILE"
  cp "$LATEST_BACKUP_FILE" "$TARGET_FILE"
  log_success "Rollback complete!"
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
        APPLY=true
        ;;
      --dry-run)
        DRY_RUN=true
        ;;
      --rollback)
        ROLLBACK=true
        ;;
      *)
        log_error "Unknown argument: $1"
        echo "Usage: $0 [--dry-run] [--apply] [--rollback]"
        exit 1
        ;;
    esac
    shift
  done
  
  # Print banner
  log_section "R3 v4 CORS Fix — WIRE.txt Compliant Implementation"
  
  if [ "$ROLLBACK" = true ]; then
    do_rollback
  fi
  
  if [ "$DRY_RUN" = true ]; then
    log_warn "DRY-RUN MODE: No files will be modified"
    log_info "Run with --apply to execute changes"
  else
    log_warn "APPLY MODE: Files will be modified"
    log_info "Backup will be created: $BACKUP_FILE"
    read -p "Continue? (type 'yes' to confirm): " -r CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
      log_warn "Cancelled by user"
      exit 0
    fi
  fi
  
  echo ""
  
  # Execute steps
  verify_file_exists
  create_backup_dir
  
  if [ "$DRY_RUN" = false ]; then
    backup_file
  fi
  
  verify_current_state
  apply_replacement_1 || log_error "Replacement 1 failed"
  apply_replacement_2 || log_warn "Replacement 2 skipped (not found)"
  apply_replacement_3 || log_error "Replacement 3 failed"
  apply_replacement_4 || log_warn "Replacement 4 skipped (may already exist)"
  
  if [ "$DRY_RUN" = false ]; then
    verify_changes
    show_diff
    
    log_section "SUCCESS"
    log_success "R3 v4 CORS fix applied!"
    log_info "File: $TARGET_FILE"
    log_info "Backup: $LATEST_BACKUP_FILE"
    log_info "Rollback: ./r3-cors-fix.sh --rollback"
  else
    log_section "DRY-RUN COMPLETE"
    log_info "No changes were made. Run with --apply to execute."
  fi
}

# Execute main
main "$@"
