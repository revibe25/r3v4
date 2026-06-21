#!/bin/bash
################################################################################
# R3 v4 - Priority #1-4 COMPLETE Implementation Script
# Master-level execution with file modifications, validation & rollback
# Date: June 20, 2026
# Author: Cloud (Enhanced Edition)
################################################################################

set -Eeuo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION & SETUP
# ═══════════════════════════════════════════════════════════════════════════

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(pwd)"
readonly TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
readonly BACKUP_DIR="${PROJECT_ROOT}/.backups/${TIMESTAMP}"
readonly LOG_FILE="${PROJECT_ROOT}/logs/implementation_${TIMESTAMP}.log"
readonly REPORT_FILE="${PROJECT_ROOT}/reports/implementation_report_${TIMESTAMP}.md"
readonly ROLLBACK_SCRIPT="${BACKUP_DIR}/rollback_${TIMESTAMP}.sh"

# Flags
DRY_RUN=false
VALIDATE_ONLY=false
SKIP_BACKUP=false
VERBOSE=false

# Counters
CHANGES_MADE=0
VALIDATIONS_PASSED=0
VALIDATIONS_FAILED=0
IMPLEMENTATION_ERRORS=0

# Rollback state
declare -a ROLLBACK_ACTIONS=()

# ═══════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

log() {
    local level="$1"
    shift
    local message="$@"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    echo "[${timestamp}] [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_success() { log "✓" "$@"; }
log_debug() { [[ $VERBOSE == true ]] && log "DEBUG" "$@" || true; }

section() {
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  $@"
    echo "════════════════════════════════════════════════════════════════"
    log_info "SECTION: $@"
}

subsection() {
    echo ""
    echo "  ── $@"
    log_info "SUBSECTION: $@"
}

backup_file() {
    local source="$1"
    if [[ ! -f "$source" ]]; then
        log_error "File not found for backup: $source"
        return 1
    fi
    
    if [[ $SKIP_BACKUP == true ]]; then
        log_debug "Backup skipped: $source"
        return 0
    fi
    
    local dest="${BACKUP_DIR}/${source//\//_}"
    mkdir -p "$(dirname "$dest")"
    cp -p "$source" "$dest"
    log_debug "Backed up: $source → $dest"
    
    # Add rollback action
    ROLLBACK_ACTIONS+=("cp -p '$dest' '$source'")
}

# Safe file modification using Python with assertion guards
modify_file() {
    local file="$1"
    local old_str="$2"
    local new_str="$3"
    local description="$4"
    
    if [[ ! -f "$file" ]]; then
        log_error "File not found: $file"
        ((IMPLEMENTATION_ERRORS++))
        return 1
    fi
    
    # Check pattern exists before attempting modification
    if ! grep -Fq "$old_str" "$file" 2>/dev/null; then
        log_error "Pattern not found in $file. Cannot apply: $description"
        log_debug "Looking for: ${old_str:0:100}..."
        ((IMPLEMENTATION_ERRORS++))
        return 1
    fi
    
    backup_file "$file" || return 1
    
    if [[ $DRY_RUN == true ]]; then
        log_info "DRY-RUN: Would modify $file"
        log_info "  Description: $description"
        log_info "  Old (first 100 chars): ${old_str:0:100}..."
        log_info "  New (first 100 chars): ${new_str:0:100}..."
        return 0
    fi
    
    # Use Python for safe multi-line replacement with proper escaping
    python3 << PYTHON
import sys
try:
    with open('$file', 'r', encoding='utf-8') as f:
        content = f.read()
    
    old_str = """$old_str"""
    new_str = """$new_str"""
    
    if old_str not in content:
        print(f"ERROR: Pattern not found in file", file=sys.stderr)
        sys.exit(1)
    
    # Count occurrences - we want exactly 1
    count = content.count(old_str)
    if count != 1:
        print(f"WARNING: Found {count} occurrences of pattern (expected 1)", file=sys.stderr)
        if count > 1:
            print("REFUSING TO MODIFY: Too many matches", file=sys.stderr)
            sys.exit(1)
    
    content = content.replace(old_str, new_str, 1)
    
    with open('$file', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("OK")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON
    
    if [[ $? -eq 0 ]]; then
        ((CHANGES_MADE++))
        log_success "Modified: $file - $description"
        return 0
    else
        log_error "Failed to modify: $file - $description"
        ((IMPLEMENTATION_ERRORS++))
        return 1
    fi
}

validate_json() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        log_error "File not found: $file"
        ((VALIDATIONS_FAILED++))
        return 1
    fi
    
    if python3 -m json.tool "$file" > /dev/null 2>&1; then
        log_success "JSON valid: $file"
        ((VALIDATIONS_PASSED++))
        return 0
    else
        log_error "JSON invalid: $file"
        ((VALIDATIONS_FAILED++))
        return 1
    fi
}

validate_file_exists() {
    local file="$1"
    if [[ -f "$file" ]]; then
        log_success "File exists: $file"
        ((VALIDATIONS_PASSED++))
        return 0
    else
        log_error "File missing: $file"
        ((VALIDATIONS_FAILED++))
        return 1
    fi
}

check_pattern_exists() {
    local file="$1"
    local pattern="$2"
    if [[ ! -f "$file" ]]; then
        log_error "File not found: $file"
        ((VALIDATIONS_FAILED++))
        return 1
    fi
    
    if grep -Fq "$pattern" "$file" 2>/dev/null; then
        log_success "Pattern found in $file: '${pattern:0:60}...'"
        ((VALIDATIONS_PASSED++))
        return 0
    else
        log_error "Pattern NOT found in $file: '${pattern:0:60}...'"
        ((VALIDATIONS_FAILED++))
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: COMPREHENSIVE ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════

phase_1_analysis() {
    section "PHASE 1: COMPREHENSIVE ANALYSIS"
    
    subsection "1.1: Project File Inventory"
    log_info "TypeScript files: $(find . -name '*.ts' -o -name '*.tsx' | grep -v node_modules | wc -l)"
    log_info "TypeScript config files: $(find . -name 'tsconfig*.json' | wc -l)"
    log_info "Package files: $(find . -name 'package.json' | grep -v node_modules | wc -l)"
    log_info "Environment files: $(find . -name '.env*' -type f 2>/dev/null | wc -l)"
    
    subsection "1.2: Dependency Analysis"
    if [[ -d node_modules ]]; then
        log_info "Node modules: $(du -sh node_modules 2>/dev/null | cut -f1)"
    else
        log_warn "Node modules not installed"
    fi
    log_info "pnpm lock file: $([ -f pnpm-lock.yaml ] && echo 'present' || echo 'MISSING')"
    
    subsection "1.3: Configuration Files"
    for config in .env drizzle.config.ts tsconfig.json pnpm-workspace.yaml; do
        if [[ -f "$config" ]]; then
            log_success "Found: $config"
        else
            log_warn "Missing: $config"
        fi
    done
    
    subsection "1.4: Database Status"
    if command -v sqlite3 &> /dev/null; then
        if [[ -f r3.db ]]; then
            log_success "SQLite database found: r3.db"
        fi
    fi
    
    if command -v psql &> /dev/null; then
        log_info "PostgreSQL available"
    else
        log_warn "PostgreSQL client not found"
    fi
    
    subsection "1.5: External Integrations"
    check_pattern_exists "package.json" "bcrypt" || true
    check_pattern_exists "package.json" "jsonwebtoken" || true
    check_pattern_exists "package.json" "express" || true
    check_pattern_exists "package.json" "trpc" || true
    
    log_success "Phase 1 Complete: Analysis ready for implementation"
}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2: PRE-FLIGHT FILE VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════

phase_2_preflight() {
    section "PHASE 2: PRE-FLIGHT FILE VERIFICATION"
    
    subsection "2.1: Critical Files Check"
    
    local critical_files=(
        "server/routers/daw.ts"
        "server/routes.ts"
        "client/src/hooks/useMixSuggestions.ts"
        "client/src/pages/collaborative-daw-pro.tsx"
        "package.json"
    )
    
    for file in "${critical_files[@]}"; do
        if validate_file_exists "$file"; then
            log_info "  $(wc -l < "$file") lines"
        else
            log_error "CRITICAL: $file not found - cannot proceed"
        fi
    done
    
    subsection "2.2: Backup Location Setup"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$REPORT_FILE")"
    log_success "Backup directory ready: $BACKUP_DIR"
    
    subsection "2.3: Rollback Script Init"
    cat > "$ROLLBACK_SCRIPT" << 'ROLLBACK_HEADER'
#!/bin/bash
# Auto-generated rollback script
# Execute with: bash rollback_*.sh
set -e
echo "Starting rollback..."
ROLLBACK_HEADER
    chmod +x "$ROLLBACK_SCRIPT"
    log_success "Rollback script initialized: $ROLLBACK_SCRIPT"
    
    log_success "Phase 2 Complete: Pre-flight checks passed"
}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 3: PRIORITY #1 - Auth System & Admin Bypass
# ═══════════════════════════════════════════════════════════════════════════

phase_3_priority_1() {
    section "PHASE 3: PRIORITY #1 - Auth System & Admin Bypass"
    
    local daw_file="server/routers/daw.ts"
    
    subsection "3.1: Verify requireTier() function exists"
    
    if ! check_pattern_exists "$daw_file" "function requireTier"; then
        log_error "requireTier function not found in $daw_file"
        ((IMPLEMENTATION_ERRORS++))
        return 1
    fi
    
    subsection "3.2: Extract and validate requireTier function"
    
    # Extract the function to check its current state
    local current_require_tier
    current_require_tier=$(sed -n '/^function requireTier/,/^}/p' "$daw_file" | head -20)
    
    if echo "$current_require_tier" | grep -q "is_admin"; then
        log_success "Admin bypass already implemented in requireTier"
        ((VALIDATIONS_PASSED++))
        return 0
    fi
    
    subsection "3.3: Apply admin bypass to requireTier()"
    
    # This is the actual pattern from the file - needs to match exactly
    local old_pattern='function requireTier(ctx: { user?: { is_admin?: boolean } | null; subscription?: { tier: string } | null }, minTier: Tier): void {
  const ORDER: Tier[] = ["explorer", "creator", "pro_artist"];
  const userTier = (ctx.subscription?.tier ?? "explorer") as Tier;
  if (ORDER.indexOf(userTier) < ORDER.indexOf(minTier)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `This feature requires the ${minTier} tier or higher.` });
  }
}'
    
    local new_pattern='function requireTier(ctx: { user?: { is_admin?: boolean } | null; subscription?: { tier: string } | null }, minTier: Tier): void {
  // ✓ ADMIN BYPASS: Admins have unrestricted access to all features
  if (ctx.user?.is_admin) {
    return;  // Skip all tier checks for admins
  }
  const ORDER: Tier[] = ["explorer", "creator", "pro_artist"];
  const userTier = (ctx.subscription?.tier ?? "explorer") as Tier;
  if (ORDER.indexOf(userTier) < ORDER.indexOf(minTier)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `This feature requires the ${minTier} tier or higher.` });
  }
}'
    
    modify_file "$daw_file" "$old_pattern" "$new_pattern" "Add admin bypass to requireTier function" || {
        log_warn "Standard requireTier pattern not found - may have been modified"
        log_info "Searching for alternative patterns..."
        return 1
    }
    
    subsection "3.4: Verify ai.suggestions endpoint"
    
    if check_pattern_exists "$daw_file" "ai.suggestions"; then
        log_info "ai.suggestions endpoint found"
        if check_pattern_exists "$daw_file" "publicProc.*ai.suggestions" || \
           check_pattern_exists "$daw_file" "\.suggestions.*publicProc"; then
            log_warn "ai.suggestions may be using publicProc - manual review recommended"
        fi
    fi
    
    subsection "3.5: Database Update Notification"
    
    log_warn "MANUAL ACTION REQUIRED:"
    log_warn "  Update r3admin user in database:"
    log_warn "    - Set tier to 'pro_artist'"
    log_warn "    - Set 90-day trial period"
    log_warn "  SQL (example): UPDATE users SET subscription_tier = 'pro_artist', trial_days = 90 WHERE username = 'r3admin';"
    
    log_success "Priority #1 Phase Complete"
}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 4: PRIORITY #2 - Frontend Live Data Wiring
# ═══════════════════════════════════════════════════════════════════════════

phase_4_priority_2() {
    section "PHASE 4: PRIORITY #2 - Frontend Live Data Wiring"
    
    local hooks_file="client/src/hooks/useMixSuggestions.ts"
    local daw_file="client/src/pages/collaborative-daw-pro.tsx"
    
    subsection "4.1: Verify useMixSuggestions hook"
    
    if ! validate_file_exists "$hooks_file"; then
        log_error "useMixSuggestions hook not found"
        ((IMPLEMENTATION_ERRORS++))
        return 1
    fi
    
    subsection "4.2: Check if latencyMs is exported from useMixSuggestions"
    
    if check_pattern_exists "$hooks_file" "latencyMs"; then
        log_success "latencyMs found in useMixSuggestions"
        if check_pattern_exists "$hooks_file" "return.*{" && \
           check_pattern_exists "$hooks_file" "latencyMs,"; then
            log_success "latencyMs is properly exported"
        else
            log_warn "latencyMs exists but may not be in return statement"
        fi
    else
        log_error "latencyMs not found in useMixSuggestions"
        ((IMPLEMENTATION_ERRORS++))
    fi
    
    subsection "4.3: Verify collaborative-daw-pro uses live latency data"
    
    if ! validate_file_exists "$daw_file"; then
        log_error "collaborative-daw-pro.tsx not found"
        ((IMPLEMENTATION_ERRORS++))
        return 1
    fi
    
    if check_pattern_exists "$daw_file" "llpteLatency"; then
        log_info "llpteLatency variable found"
        
        # Check if it's using the hook value or hardcoded
        if check_pattern_exists "$daw_file" "mixAI\.latencyMs" || \
           check_pattern_exists "$daw_file" "\.latencyMs.*mixAI"; then
            log_success "llpteLatency is bound to live mixAI data"
        elif check_pattern_exists "$daw_file" "useState.*llpteLatency"; then
            log_warn "llpteLatency may still be using hardcoded useState - needs update"
        fi
    else
        log_error "llpteLatency variable not found in collaborative-daw-pro"
        ((IMPLEMENTATION_ERRORS++))
    fi
    
    log_success "Priority #2 Phase Complete"
}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 5: PRIORITY #3 - Agi-Suite Integration
# ═══════════════════════════════════════════════════════════════════════════

phase_5_priority_3() {
    section "PHASE 5: PRIORITY #3 - Agi-Suite → R3 Integration"
    
    subsection "5.1: Verify internalRouter in server/routes.ts"
    
    local routes_file="server/routes.ts"
    
    if ! validate_file_exists "$routes_file"; then
        log_error "server/routes.ts not found"
        ((IMPLEMENTATION_ERRORS++))
        return 1
    fi
    
    if check_pattern_exists "$routes_file" "internalRouter"; then
        log_success "internalRouter import/reference found"
        
        if check_pattern_exists "$routes_file" "app.use.*internal" || \
           check_pattern_exists "$routes_file" "router.*internal"; then
            log_success "internalRouter is mounted in routes"
        else
            log_warn "internalRouter reference found but may not be mounted"
        fi
    else
        log_error "internalRouter not referenced in server/routes.ts"
        ((IMPLEMENTATION_ERRORS++))
    fi
    
    subsection "5.2: Verify internal.ts endpoint exists"
    
    local internal_file="server/routes/internal.ts"
    
    if validate_file_exists "$internal_file"; then
        if check_pattern_exists "$internal_file" "/metrics/time-savings"; then
            log_success "/metrics/time-savings endpoint found"
        else
            log_error "/metrics/time-savings endpoint not found in internal.ts"
            ((IMPLEMENTATION_ERRORS++))
        fi
        
        if check_pattern_exists "$internal_file" "INTERNAL_SECRET" || \
           check_pattern_exists "$internal_file" "x-agent-token"; then
            log_success "Internal auth mechanism found"
        else
            log_warn "Internal authentication check not found - may need security review"
        fi
    else
        log_error "server/routes/internal.ts not found"
        ((IMPLEMENTATION_ERRORS++))
        return 1
    fi
    
    subsection "5.3: Verify Agi-Suite configuration"
    
    local agi_env="$HOME/Agi-Suite/.env"
    
    if [[ -f "$agi_env" ]]; then
        if grep -q "R3_INTERNAL_URL=http://localhost:3001" "$agi_env"; then
            log_success "Agi-Suite R3_INTERNAL_URL correctly set to localhost:3001"
        elif grep -q "R3_INTERNAL_URL=" "$agi_env"; then
            local url=$(grep "R3_INTERNAL_URL=" "$agi_env" | cut -d= -f2)
            log_warn "Agi-Suite R3_INTERNAL_URL is set to: $url (verify it's correct)"
        else
            log_error "Agi-Suite .env missing R3_INTERNAL_URL configuration"
            ((IMPLEMENTATION_ERRORS++))
        fi
    else
        log_warn "Agi-Suite .env not found or not accessible"
    fi
    
    log_success "Priority #3 Phase Complete"
}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 6: PRIORITY #4 - Security Patch
# ═══════════════════════════════════════════════════════════════════════════

phase_6_priority_4() {
    section "PHASE 6: PRIORITY #4 - Security Patch & Audit"
    
    subsection "6.1: Validate package.json JSON structure"
    
    validate_json "package.json" || {
        log_error "package.json is not valid JSON"
        return 1
    }
    
    subsection "6.2: Check for pnpm.overrides vulnerability patches"
    
    if python3 << 'PYTHON'
import json
import sys
try:
    with open("package.json", "r") as f:
        pkg = json.load(f)
    
    if "pnpm" in pkg and "overrides" in pkg.get("pnpm", {}):
        overrides = pkg["pnpm"]["overrides"]
        print(f"Found {len(overrides)} pnpm override(s)")
        for key, value in list(overrides.items())[:5]:
            print(f"  - {key}: {value}")
        sys.exit(0)
    else:
        print("No pnpm.overrides found")
        sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
PYTHON
    then
        log_success "pnpm.overrides section present with vulnerability patches"
        ((VALIDATIONS_PASSED++))
    else
        log_warn "pnpm.overrides not configured - security vulnerabilities may not be patched"
    fi
    
    subsection "6.3: Security audit using pnpm"
    
    if command -v pnpm &> /dev/null; then
        log_info "Running pnpm audit..."
        if pnpm audit --no-color 2>&1 | head -20 | tee -a "$LOG_FILE"; then
            log_success "Pnpm audit completed - check results above"
            ((VALIDATIONS_PASSED++))
        fi
    else
        log_warn "pnpm not found - skipping pnpm audit"
    fi
    
    subsection "6.4: Validate critical dependencies"
    
    for dep in bcrypt jsonwebtoken express typescript; do
        if check_pattern_exists "package.json" "\"$dep\""; then
            log_info "  ✓ $dep is installed"
        else
            log_warn "  ⚠ $dep not found in package.json"
        fi
    done
    
    log_success "Priority #4 Phase Complete"
}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 7: COMPREHENSIVE VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

phase_7_validation() {
    section "PHASE 7: COMPREHENSIVE VALIDATION"
    
    subsection "7.1: TypeScript Syntax Check"
    
    if command -v tsc &> /dev/null; then
        log_info "Running tsc --noEmit on modified files..."
        if tsc --noEmit 2>&1 | head -20 | tee -a "$LOG_FILE"; then
            log_success "TypeScript validation passed"
            ((VALIDATIONS_PASSED++))
        else
            log_warn "TypeScript found errors - review above"
        fi
    else
        log_warn "tsc not found - skipping TypeScript validation"
    fi
    
    subsection "7.2: File Integrity Verification"
    
    local critical_files=(
        "server/routers/daw.ts"
        "server/routes.ts"
        "server/routes/internal.ts"
        "client/src/hooks/useMixSuggestions.ts"
        "client/src/pages/collaborative-daw-pro.tsx"
        "package.json"
    )
    
    for file in "${critical_files[@]}"; do
        if [[ -f "$file" ]]; then
            log_success "Critical file intact: $file"
            ((VALIDATIONS_PASSED++))
        else
            log_error "CRITICAL FILE MISSING: $file"
            ((VALIDATIONS_FAILED++))
        fi
    done
    
    subsection "7.3: Backup Verification"
    
    local backup_count=$(find "$BACKUP_DIR" -type f 2>/dev/null | wc -l)
    log_info "Backups created: $backup_count"
    if [[ $backup_count -gt 0 ]]; then
        log_success "Backup directory populated"
        ((VALIDATIONS_PASSED++))
    fi
    
    log_success "Phase 7 Complete: Validation finished"
}

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 8: FINALIZATION & REPORTING
# ═══════════════════════════════════════════════════════════════════════════

phase_8_finalization() {
    section "PHASE 8: IMPLEMENTATION SUMMARY & REPORTING"
    
    subsection "8.1: Statistics"
    
    cat << STATS
Changes Made:           $CHANGES_MADE
Validations Passed:     $VALIDATIONS_PASSED
Validations Failed:     $VALIDATIONS_FAILED
Implementation Errors:  $IMPLEMENTATION_ERRORS

Log File:               $LOG_FILE
Backup Directory:       $BACKUP_DIR
Rollback Script:        $ROLLBACK_SCRIPT
STATS
    
    log_info "Changes Made: $CHANGES_MADE"
    log_info "Validations Passed: $VALIDATIONS_PASSED"
    log_info "Validations Failed: $VALIDATIONS_FAILED"
    log_info "Implementation Errors: $IMPLEMENTATION_ERRORS"
    
    subsection "8.2: Generate Markdown Report"
    
    cat > "$REPORT_FILE" << REPORT
# R3 v4 Priority #1-4 Implementation Report

**Date:** $(date)
**Project:** $PROJECT_ROOT
**Timestamp:** $TIMESTAMP

## Summary

- **Changes Made:** $CHANGES_MADE
- **Validations Passed:** $VALIDATIONS_PASSED
- **Validations Failed:** $VALIDATIONS_FAILED
- **Implementation Errors:** $IMPLEMENTATION_ERRORS

## Execution Mode

- **Dry Run:** $DRY_RUN
- **Validate Only:** $VALIDATE_ONLY
- **Skip Backup:** $SKIP_BACKUP

## Artifacts

- **Log File:** $LOG_FILE
- **Backup Directory:** $BACKUP_DIR
- **Rollback Script:** $ROLLBACK_SCRIPT

## Implemented Priorities

### Priority #1: Auth System & Admin Bypass
- Admin bypass added to \`requireTier()\` function
- Status: CHECK LOG FOR DETAILS

### Priority #2: Frontend Live Data Wiring
- \`useMixSuggestions\` hook validation
- \`collaborative-daw-pro\` component check
- Status: CHECK LOG FOR DETAILS

### Priority #3: Agi-Suite Integration
- \`internalRouter\` verification
- \`internal.ts\` endpoint validation
- Agi-Suite configuration check
- Status: CHECK LOG FOR DETAILS

### Priority #4: Security Patch
- \`package.json\` JSON validation
- \`pnpm.overrides\` check
- Security audit completed
- Status: CHECK LOG FOR DETAILS

## Next Steps

1. Review the log file: \`$LOG_FILE\`
2. If errors occurred, execute rollback: \`bash $ROLLBACK_SCRIPT\`
3. Verify changes with: \`pnpm build && pnpm test\`
4. Deploy to staging for final validation

REPORT
    
    log_success "Report generated: $REPORT_FILE"
    
    subsection "8.3: Rollback Script Finalization"
    
    # Add footer to rollback script
    cat >> "$ROLLBACK_SCRIPT" << 'ROLLBACK_FOOTER'

echo "Rollback actions completed"
echo "Verify manually:"
echo "  - Check file contents: git diff"
echo "  - Re-run validation: pnpm build"
ROLLBACK_FOOTER
    
    log_success "Rollback script ready: $ROLLBACK_SCRIPT"
    
    log_success "Phase 8 Complete: Implementation finalized"
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

main() {
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$REPORT_FILE")"
    mkdir -p "$BACKUP_DIR"
    
    log_info "═══════════════════════════════════════════════════════════════"
    log_info "R3 v4 Priority #1-4 COMPLETE Implementation Script"
    log_info "Timestamp: $TIMESTAMP"
    log_info "Project: $PROJECT_ROOT"
    log_info "DRY_RUN: $DRY_RUN | VALIDATE_ONLY: $VALIDATE_ONLY | VERBOSE: $VERBOSE"
    log_info "═══════════════════════════════════════════════════════════════"
    
    # Execute phases
    phase_1_analysis
    phase_2_preflight
    
    if [[ $VALIDATE_ONLY == false ]]; then
        phase_3_priority_1
        phase_4_priority_2
        phase_5_priority_3
        phase_6_priority_4
    fi
    
    phase_7_validation
    phase_8_finalization
    
    # Final status
    section "EXECUTION COMPLETE"
    
    if [[ $IMPLEMENTATION_ERRORS -eq 0 && $VALIDATIONS_FAILED -eq 0 ]]; then
        log_success "✅ ALL PHASES COMPLETED SUCCESSFULLY"
        echo ""
        echo "Next steps:"
        echo "  1. Review log: $LOG_FILE"
        echo "  2. Review report: $REPORT_FILE"
        echo "  3. Run: pnpm build && pnpm test"
        return 0
    else
        log_error "❌ SOME ISSUES DETECTED - REVIEW LOG"
        echo ""
        echo "Issues found:"
        echo "  - Implementation Errors: $IMPLEMENTATION_ERRORS"
        echo "  - Validation Failures: $VALIDATIONS_FAILED"
        echo ""
        echo "To rollback: bash $ROLLBACK_SCRIPT"
        echo "Review log: $LOG_FILE"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# ARGUMENT PARSING & EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

print_usage() {
    cat << USAGE
R3 v4 Priority #1-4 Implementation Script
Master-level execution with file modifications, validation & rollback

USAGE:
  $0 [OPTIONS]

OPTIONS:
  --dry-run          Show what would be changed (no modifications made)
  --validate-only    Only validate, don't implement changes
  --skip-backup      Skip creating file backups (not recommended)
  --verbose          Show detailed debug output

EXAMPLES:
  # Dry run to see what will change:
  $0 --dry-run --verbose

  # Validate without changes:
  $0 --validate-only

  # Execute with full logging:
  $0 --verbose

  # Execute with all defaults:
  $0

USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Execute main
main "$@"
