#!/bin/bash
################################################################################
# R3 v4 Priority #1-4 - Interactive Execution Checklist
# Run this on your Penguin machine to track implementation progress
################################################################################

CHECKLIST_FILE="${1:-.r3v4_checklist_$(date +%Y%m%d_%H%M%S)}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
COMPLETED=0
TOTAL=0

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  R3 v4 Priority #1-4 IMPLEMENTATION CHECKLIST"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Start Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Checklist Log: $CHECKLIST_FILE"
echo ""

# Initialize checklist
cat > "$CHECKLIST_FILE" << HEADER
R3 v4 Priority #1-4 Implementation Checklist
=============================================
Date: $(date '+%Y-%m-%d %H:%M:%S')
User: $(whoami)
Host: $(hostname)
Directory: $(pwd)

HEADER

check() {
    local step_num="$1"
    local description="$2"
    local command="$3"
    
    ((TOTAL++))
    
    echo ""
    echo -e "${BLUE}[$step_num]${NC} $description"
    echo "   Command: $command"
    read -p "   Execute? (y/n/s=skip) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}→${NC} Running..."
        echo "" >> "$CHECKLIST_FILE"
        echo "[$(date '+%H:%M:%S')] Step $step_num - EXECUTING" >> "$CHECKLIST_FILE"
        
        if eval "$command" 2>&1 | tee -a "$CHECKLIST_FILE"; then
            echo -e "${GREEN}✓${NC} COMPLETED"
            echo "[$(date '+%H:%M:%S')] Step $step_num - SUCCESS" >> "$CHECKLIST_FILE"
            ((COMPLETED++))
            return 0
        else
            echo -e "${RED}✗${NC} FAILED - Review output above"
            echo "[$(date '+%H:%M:%S')] Step $step_num - FAILED" >> "$CHECKLIST_FILE"
            return 1
        fi
    elif [[ $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${YELLOW}→${NC} SKIPPED"
        echo "[$(date '+%H:%M:%S')] Step $step_num - SKIPPED" >> "$CHECKLIST_FILE"
        return 0
    else
        echo -e "${RED}→${NC} ABORTED"
        return 1
    fi
}

section() {
    echo ""
    echo "════════════════════════════════════════════════════════════════════════"
    echo "  $@"
    echo "════════════════════════════════════════════════════════════════════════"
    echo "" >> "$CHECKLIST_FILE"
    echo "════════════════════════════════════════════════════════════════════════" >> "$CHECKLIST_FILE"
    echo "  $@" >> "$CHECKLIST_FILE"
    echo "════════════════════════════════════════════════════════════════════════" >> "$CHECKLIST_FILE"
}

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 1: SETUP
# ═══════════════════════════════════════════════════════════════════════════

section "SECTION 1: SETUP (5 minutes)"

check "1.1" "Navigate to Stable directory" "cd ~/Stable && pwd"
check "1.2" "Copy implementation script" "cp /mnt/user-data/outputs/r3v4-priority-1-4-complete.sh ./r3v4-complete.sh && ls -lh r3v4-complete.sh"
check "1.3" "Copy precheck script" "cp /mnt/user-data/outputs/precheck.sh . && chmod +x precheck.sh && ls -lh precheck.sh"
check "1.4" "Copy postcheck script" "cp /mnt/user-data/outputs/postcheck.sh . && chmod +x postcheck.sh && ls -lh postcheck.sh"
check "1.5" "Make implementation script executable" "chmod +x r3v4-complete.sh && ls -lh r3v4-complete.sh"

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 2: PRE-FLIGHT VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

section "SECTION 2: PRE-FLIGHT VALIDATION (2 minutes)"

check "2.1" "Run pre-flight check" "./precheck.sh ."

read -p "Continue? Pre-flight must have passed (y/n) " -n 1 -r
echo ""
if ! [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Pre-flight check failed or aborted. Fix issues and restart."
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 3: DRY RUN
# ═══════════════════════════════════════════════════════════════════════════

section "SECTION 3: DRY RUN - SAFE PREVIEW (5 minutes)"

check "3.1" "Run dry-run with verbose output" "./r3v4-complete.sh --dry-run --verbose 2>&1 | tee /tmp/dryrun_\$(date +%s).log"

echo ""
echo -e "${BLUE}→${NC} Review dry-run output for:"
echo "   • 'DRY-RUN: Would modify' entries"
echo "   • 'ERROR' messages (should be none)"
echo "   • Pattern checks pass/fail"
echo ""

read -p "Does dry-run look good? (y/n) " -n 1 -r
echo ""
if ! [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Dry-run revealed issues. Review the output above before proceeding."
    exit 1
fi

((COMPLETED++))

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 4: EXECUTE IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════════════════

section "SECTION 4: EXECUTE IMPLEMENTATION (15 minutes)"

echo ""
echo -e "${RED}⚠️  WARNING⚠️${NC}"
echo "This will modify files in your project."
echo "Backups will be created automatically."
echo "You can rollback if anything goes wrong."
echo ""

read -p "Continue with implementation? (y/n) " -n 1 -r
echo ""
if ! [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Implementation aborted by user."
    exit 1
fi

check "4.1" "Execute implementation script" "./r3v4-complete.sh --verbose 2>&1 | tee /tmp/execute_\$(date +%s).log"

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 5: POST-EXECUTION VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

section "SECTION 5: POST-EXECUTION VALIDATION (2 minutes)"

check "5.1" "Run post-check validation" "./postcheck.sh ."

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 6: MANUAL ACTIONS
# ═══════════════════════════════════════════════════════════════════════════

section "SECTION 6: MANUAL ACTIONS REQUIRED (5 minutes)"

echo ""
echo -e "${BLUE}→${NC} Priority #1: Update r3admin in Database"
echo ""

# Check which database they have
if [[ -f ~/Stable/r3.db ]]; then
    echo "   Using SQLite (r3.db)"
    check "6.1" "Update r3admin in SQLite" "sqlite3 ~/Stable/r3.db << SQL
UPDATE users SET is_admin = 1, subscription_tier = 'pro_artist' WHERE username = 'r3admin';
SELECT 'Verification:' as '';
SELECT username, is_admin, subscription_tier FROM users WHERE username = 'r3admin';
SQL"
else
    echo "   Using PostgreSQL (Railway)"
    echo ""
    echo -e "${YELLOW}⚠${NC} Manual action required:"
    echo "   1. Go to Railway console"
    echo "   2. Open PostgreSQL database"
    echo "   3. Run: UPDATE users SET is_admin = true, subscription_tier = 'pro_artist' WHERE username = 'r3admin';"
    echo "   4. Press enter when done"
    read -p "   Completed? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ((COMPLETED++))
    fi
fi

echo ""
echo -e "${BLUE}→${NC} Priority #3: Configure Agi-Suite"
echo ""

check "6.2" "Verify Agi-Suite .env" "cat ~/Agi-Suite/.env 2>/dev/null | grep -i R3_INTERNAL || echo 'R3_INTERNAL_URL not yet configured'"

read -p "Is R3_INTERNAL_URL set to http://localhost:3001? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ((COMPLETED++))
else
    check "6.3" "Add R3_INTERNAL_URL to Agi-Suite .env" "echo 'R3_INTERNAL_URL=http://localhost:3001' >> ~/Agi-Suite/.env && tail ~/Agi-Suite/.env"
fi

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 7: BUILD & VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════

section "SECTION 7: BUILD & VERIFICATION (10 minutes)"

check "7.1" "Run pnpm install" "pnpm install 2>&1 | tail -20"
check "7.2" "TypeScript compilation check" "pnpm tsc --noEmit 2>&1 | head -30"
check "7.3" "Build project" "pnpm build 2>&1 | tail -30"
check "7.4" "Run tests (optional)" "pnpm test 2>&1 | tail -30 || true"

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 8: FINAL STATUS
# ═══════════════════════════════════════════════════════════════════════════

section "SECTION 8: FINAL STATUS & NEXT STEPS"

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  IMPLEMENTATION PROGRESS"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "Completed: ${GREEN}$COMPLETED${NC} / $TOTAL steps"
echo ""

# Final verification
if [[ -f logs/implementation_*.log ]]; then
    latest_log=$(ls -t logs/implementation_*.log 2>/dev/null | head -1)
    echo -e "Latest log: ${BLUE}$latest_log${NC}"
fi

if [[ -f reports/implementation_*.md ]]; then
    latest_report=$(ls -t reports/implementation_*.md 2>/dev/null | head -1)
    echo -e "Latest report: ${BLUE}$latest_report${NC}"
fi

if [[ -d .backups ]]; then
    backup_count=$(find .backups -type f 2>/dev/null | wc -l)
    echo -e "Backups created: ${GREEN}$backup_count files${NC}"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""

if [[ $COMPLETED -eq $TOTAL ]]; then
    echo -e "${GREEN}✓ ALL STEPS COMPLETED${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Verify database r3admin update"
    echo "  2. Verify Agi-Suite .env configuration"
    echo "  3. Run: git add -A && git commit -m 'Priority #1-4 implementation'"
    echo "  4. Deploy: git push origin main"
    echo ""
    echo "Checklist saved to: $CHECKLIST_FILE"
else
    echo -e "${YELLOW}⚠ SOME STEPS INCOMPLETE${NC}"
    echo ""
    echo "Review the checklist and complete remaining steps."
    echo "Checklist saved to: $CHECKLIST_FILE"
fi

echo ""
echo "End Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Save final summary to checklist
cat >> "$CHECKLIST_FILE" << FOOTER

════════════════════════════════════════════════════════════════════════
FINAL STATUS
════════════════════════════════════════════════════════════════════════
Completed: $COMPLETED / $TOTAL steps
End Time: $(date '+%Y-%m-%d %H:%M:%S')

If all steps completed successfully, ready for:
  1. Final git commit
  2. Railway deployment
  3. Production verification

FOOTER

echo "Checklist logged to: $CHECKLIST_FILE"
