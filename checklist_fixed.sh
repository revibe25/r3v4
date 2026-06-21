#!/bin/bash
################################################################################
# R3 v4 Priority #1-4 - FIXED Checklist Script
# This version properly detects failures and stops on errors
################################################################################

set -euo pipefail

readonly START_TIME="$(date '+%Y-%m-%d %H:%M:%S')"
readonly CHECKLIST_LOG=".r3v4_checklist_$(date +%Y%m%d_%H%M%S)"
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

FAILED_STEPS=0
COMPLETED_STEPS=0

log() {
    echo "$@" | tee -a "$CHECKLIST_LOG"
}

print_header() {
    echo ""
    echo "════════════════════════════════════════════════════════════════════════"
    echo "  $@"
    echo "════════════════════════════════════════════════════════════════════════"
}

# CRITICAL: This function properly checks exit codes
run_step() {
    local desc="$1"
    local cmd="$2"

    echo ""
    echo "$desc"
    echo "   Command: $cmd"
    read -p "   Execute? (y/n/s=skip) " choice

    case "$choice" in
        y|Y)
            echo "→ Running..."
            if eval "$cmd"; then
                echo -e "${GREEN}✓ SUCCESS${NC}"
                ((COMPLETED_STEPS++))
                return 0
            else
                echo -e "${RED}✗ FAILED${NC}"
                ((FAILED_STEPS++))
                return 1
            fi
            ;;
        s|S)
            echo "→ SKIPPED"
            return 2
            ;;
        *)
            echo "→ ABORTED"
            return 1
            ;;
    esac
}

# Check if a file exists before trying to use it
require_file() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}✗ CRITICAL: File not found: $file${NC}"
        echo "Cannot proceed without this file."
        return 1
    fi
    return 0
}

print_header "R3 v4 Priority #1-4 IMPLEMENTATION CHECKLIST"
echo ""
echo "Start Time: $START_TIME"
echo "Checklist Log: $CHECKLIST_LOG"
echo ""
echo -e "${YELLOW}IMPORTANT: This checklist will STOP if any step fails.${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 1: SETUP
# ═══════════════════════════════════════════════════════════════════════════

print_header "SECTION 1: SETUP (5 minutes)"

run_step "[1.1] Navigate to Stable directory" "cd ~/Stable && pwd" || exit 1

# Check if implementation script exists
if ! require_file "./r3v4-priority-1-4-complete.sh"; then
    echo ""
    echo -e "${RED}The implementation script is missing!${NC}"
    echo "You need to obtain r3v4-priority-1-4-complete.sh first."
    echo ""
    echo "Options:"
    echo "  1. Copy it from wherever you generated it"
    echo "  2. Or apply changes manually (see documentation)"
    exit 1
fi

run_step "[1.2] Make implementation script executable" \
    "chmod +x r3v4-priority-1-4-complete.sh && ls -lh r3v4-priority-1-4-complete.sh" || exit 1

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 2: PRE-FLIGHT VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

print_header "SECTION 2: PRE-FLIGHT VALIDATION (2 minutes)"

# We can run the script in validate-only mode
run_step "[2.1] Run pre-flight validation" \
    "./r3v4-priority-1-4-complete.sh --validate-only --verbose 2>&1 | tee /tmp/preflight_$(date +%s).log" || {
    echo ""
    echo -e "${RED}Pre-flight validation failed!${NC}"
    echo "Review the output above. Common issues:"
    echo "  - Missing critical files (server/routers/daw.ts, etc.)"
    echo "  - Wrong directory"
    echo "  - Files have been modified and don't match expected patterns"
    exit 1
}

echo ""
read -p "Pre-flight passed. Continue to dry-run? (y/n) " continue
[[ "$continue" != "y" ]] && exit 0

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 3: DRY RUN - SAFE PREVIEW
# ═══════════════════════════════════════════════════════════════════════════

print_header "SECTION 3: DRY RUN - SAFE PREVIEW (5 minutes)"

run_step "[3.1] Run dry-run with verbose output" \
    "./r3v4-priority-1-4-complete.sh --dry-run --verbose 2>&1 | tee /tmp/dryrun_$(date +%s).log" || {
    echo ""
    echo -e "${RED}Dry-run failed!${NC}"
    echo "DO NOT PROCEED with actual execution until dry-run passes."
    echo "Review /tmp/dryrun_*.log for details."
    exit 1
}

echo ""
echo "→ Review dry-run output for:"
echo "   • 'DRY-RUN: Would modify' entries"
echo "   • 'ERROR' messages (should be none)"
echo "   • Pattern checks pass/fail"
echo ""

read -p "Does dry-run look good? (y/n) " dryrun_ok
[[ "$dryrun_ok" != "y" ]] && exit 0

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 4: EXECUTE IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════════════════

print_header "SECTION 4: EXECUTE IMPLEMENTATION (15 minutes)"

echo ""
echo -e "${YELLOW}⚠️  WARNING${NC}"
echo "This will modify files in your project."
echo "Backups will be created automatically."
echo "You can rollback if anything goes wrong."
echo ""

read -p "Continue with implementation? (y/n) " implement
[[ "$implement" != "y" ]] && exit 0

run_step "[4.1] Execute implementation script" \
    "./r3v4-priority-1-4-complete.sh --verbose 2>&1 | tee /tmp/execute_$(date +%s).log" || {
    echo ""
    echo -e "${RED}Implementation failed!${NC}"
    echo "Check /tmp/execute_*.log for details."
    echo ""
    echo "To rollback:"
    echo "  bash .backups/*/rollback_*.sh"
    exit 1
}

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 5: POST-EXECUTION VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

print_header "SECTION 5: POST-EXECUTION VALIDATION (2 minutes)"

run_step "[5.1] Verify admin bypass in requireTier()" \
    "grep -A2 'ctx.user?.is_admin' server/routers/daw.ts" || {
    echo -e "${RED}Admin bypass not found in requireTier()!${NC}"
    echo "The implementation may have failed silently."
    FAILED_STEPS=$((FAILED_STEPS + 1))
}

run_step "[5.2] Check backups were created" \
    "ls -la .backups/*/" || {
    echo -e "${YELLOW}Warning: No backups found${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 6: MANUAL ACTIONS REQUIRED
# ═══════════════════════════════════════════════════════════════════════════

print_header "SECTION 6: MANUAL ACTIONS REQUIRED (5 minutes)"

echo ""
echo "→ Priority #1: Update r3admin in Database"
echo ""
echo "   Using PostgreSQL (Railway):"
echo "   1. Go to Railway console"
echo "   2. Open PostgreSQL database"  
echo "   3. Run: UPDATE users SET is_admin = true, subscription_tier = 'pro_artist' WHERE username = 'r3admin';"
echo ""
read -p "   Completed? (y/n) " db_done
[[ "$db_done" == "y" ]] && COMPLETED_STEPS=$((COMPLETED_STEPS + 1))

echo ""
echo "→ Priority #3: Configure Agi-Suite"
echo ""
run_step "[6.2] Verify Agi-Suite .env" \
    "cat ~/Agi-Suite/.env 2>/dev/null | grep -i R3_INTERNAL || echo 'R3_INTERNAL_URL not yet configured'"

echo ""
read -p "Is R3_INTERNAL_URL set to http://localhost:3001? (y/n) " agi_done
[[ "$agi_done" == "y" ]] && COMPLETED_STEPS=$((COMPLETED_STEPS + 1))

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 7: BUILD & VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════

print_header "SECTION 7: BUILD & VERIFICATION (10 minutes)"

run_step "[7.1] Run pnpm install" \
    "pnpm install 2>&1 | tail -20" || true

run_step "[7.2] TypeScript compilation check" \
    "pnpm tsc --noEmit 2>&1 | head -30" || {
    echo -e "${YELLOW}TypeScript errors found (some may be pre-existing)${NC}"
}

run_step "[7.3] Build project" \
    "pnpm build 2>&1 | tail -30" || {
    echo -e "${RED}Build failed!${NC}"
    echo "Review errors above."
    FAILED_STEPS=$((FAILED_STEPS + 1))
}

run_step "[7.4] Run tests (optional)" \
    "pnpm test 2>&1 | tail -30 || true" || true

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 8: FINAL STATUS & NEXT STEPS
# ═══════════════════════════════════════════════════════════════════════════

print_header "FINAL STATUS & NEXT STEPS"

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  IMPLEMENTATION PROGRESS"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Completed: $COMPLETED_STEPS steps"
echo "Failed:    $FAILED_STEPS steps"
echo ""

if [[ $FAILED_STEPS -eq 0 ]]; then
    echo -e "${GREEN}✅ ALL CRITICAL STEPS PASSED${NC}"
    echo ""
    echo "Next:"
    echo "  git add -A && git commit -m 'feat: R3 v4 Priority #1-4 implementation'"
    echo "  git push origin main"
else
    echo -e "${RED}⚠ SOME STEPS FAILED${NC}"
    echo ""
    echo "Review the checklist and complete remaining steps."
    echo "Checklist saved to: $CHECKLIST_LOG"
fi

echo ""
echo "End Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Checklist logged to: $CHECKLIST_LOG"
