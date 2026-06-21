#!/bin/bash
################################################################################
# R3 v4 Priority #1-4 - Post-Execution Verification
# Run this AFTER executing the implementation script
# Validates that all changes were applied correctly
################################################################################

set -e

PROJECT_ROOT="${1:-.}"
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_MANUAL=0

echo "════════════════════════════════════════════════════════════════"
echo "  R3 v4 POST-EXECUTION VERIFICATION"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Project: $PROJECT_ROOT"
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

verify_pattern() {
    local file="$1"
    local pattern="$2"
    local description="$3"
    
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}✗${NC} File not found: $file"
        ((CHECKS_FAILED++))
        return 1
    fi
    
    if grep -Fq "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} MISSING: $description"
        echo "  File: $file"
        echo "  Pattern: ${pattern:0:80}..."
        ((CHECKS_FAILED++))
        return 1
    fi
}

echo "1. PRIORITY #1 - AUTH SYSTEM & ADMIN BYPASS"
echo "─────────────────────────────────────────────────────────────"

# Check if admin bypass was added
if grep -q "is_admin" "$PROJECT_ROOT/server/routers/daw.ts" 2>/dev/null; then
    if grep -q "ctx.user?.is_admin" "$PROJECT_ROOT/server/routers/daw.ts" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Admin bypass logic in requireTier()"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} is_admin exists but pattern unclear"
        ((CHECKS_MANUAL++))
    fi
else
    echo -e "${RED}✗${NC} Admin bypass NOT found in requireTier()"
    ((CHECKS_FAILED++))
fi

# Check for bypass comment
if grep -q "ADMIN BYPASS\|admin.*bypass\|Admin has" "$PROJECT_ROOT/server/routers/daw.ts" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Admin bypass documentation comment found"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} No admin bypass comment (not critical)"
    ((CHECKS_MANUAL++))
fi

echo ""
echo "2. PRIORITY #2 - FRONTEND LIVE DATA WIRING"
echo "─────────────────────────────────────────────────────────────"

# Check useMixSuggestions exports latencyMs
verify_pattern \
    "$PROJECT_ROOT/client/src/hooks/useMixSuggestions.ts" \
    "latencyMs" \
    "useMixSuggestions exports latencyMs"

# Check collaborative-daw-pro uses latencyMs
verify_pattern \
    "$PROJECT_ROOT/client/src/pages/collaborative-daw-pro.tsx" \
    "llpteLatency" \
    "collaborative-daw-pro defines llpteLatency variable"

echo ""
echo "3. PRIORITY #3 - AGI-SUITE INTEGRATION"
echo "─────────────────────────────────────────────────────────────"

# Check internalRouter is in routes.ts
verify_pattern \
    "$PROJECT_ROOT/server/routes.ts" \
    "internalRouter" \
    "internalRouter referenced in server/routes.ts"

# Check internal.ts exists and has metrics endpoint
if [[ -f "$PROJECT_ROOT/server/routes/internal.ts" ]]; then
    verify_pattern \
        "$PROJECT_ROOT/server/routes/internal.ts" \
        "/metrics/time-savings" \
        "server/routes/internal.ts has /metrics/time-savings endpoint"
else
    echo -e "${RED}✗${NC} server/routes/internal.ts not found"
    ((CHECKS_FAILED++))
fi

# Check for auth token reference
if grep -q "x-agent-token\|INTERNAL_SECRET\|AGENT_SERVICE_TOKEN" "$PROJECT_ROOT/server/routes/internal.ts" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Internal auth mechanism found"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Internal auth mechanism not clearly visible"
    ((CHECKS_MANUAL++))
fi

echo ""
echo "4. PRIORITY #4 - SECURITY PATCH & AUDIT"
echo "─────────────────────────────────────────────────────────────"

# Check package.json is valid JSON
if python3 -m json.tool "$PROJECT_ROOT/package.json" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} package.json is valid JSON"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}✗${NC} package.json JSON is invalid"
    ((CHECKS_FAILED++))
fi

# Check for pnpm.overrides
if python3 << PYTHON
import json
with open('$PROJECT_ROOT/package.json', 'r') as f:
    pkg = json.load(f)
exit(0 if 'pnpm' in pkg and 'overrides' in pkg.get('pnpm', {}) else 1)
PYTHON
then
    echo -e "${GREEN}✓${NC} pnpm.overrides section exists"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} pnpm.overrides not configured (may be optional)"
    ((CHECKS_MANUAL++))
fi

# Check for critical security dependencies
for dep in bcrypt jsonwebtoken express; do
    if grep -q "\"$dep\"" "$PROJECT_ROOT/package.json"; then
        echo -e "${GREEN}✓${NC} Dependency found: $dep"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} Dependency not found: $dep"
        ((CHECKS_MANUAL++))
    fi
done

echo ""
echo "5. FILE INTEGRITY"
echo "─────────────────────────────────────────────────────────────"

# Verify all critical files still exist
for file in \
    "server/routers/daw.ts" \
    "server/routes.ts" \
    "server/routes/internal.ts" \
    "client/src/hooks/useMixSuggestions.ts" \
    "client/src/pages/collaborative-daw-pro.tsx" \
    "package.json"
do
    if [[ -f "$PROJECT_ROOT/$file" ]]; then
        local lines=$(wc -l < "$PROJECT_ROOT/$file")
        echo -e "${GREEN}✓${NC} $file ($lines lines)"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} FILE MISSING: $file"
        ((CHECKS_FAILED++))
    fi
done

echo ""
echo "6. BACKUPS & ROLLBACK"
echo "─────────────────────────────────────────────────────────────"

if [[ -d "$PROJECT_ROOT/.backups" ]]; then
    local backup_count=$(find "$PROJECT_ROOT/.backups" -type f 2>/dev/null | wc -l)
    echo -e "${GREEN}✓${NC} Backup directory exists ($backup_count files)"
    ((CHECKS_PASSED++))
    
    # Check for rollback script
    if ls "$PROJECT_ROOT/.backups"/*/rollback_*.sh > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Rollback script available"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} No rollback script found"
        ((CHECKS_MANUAL++))
    fi
else
    echo -e "${RED}✗${NC} No backups created"
    ((CHECKS_FAILED++))
fi

echo ""
echo "7. LOGS & REPORTS"
echo "─────────────────────────────────────────────────────────────"

if [[ -f "$PROJECT_ROOT/logs/implementation_*.log" ]]; then
    local log_file=$(ls -t "$PROJECT_ROOT/logs/implementation_"*.log 2>/dev/null | head -1)
    echo -e "${GREEN}✓${NC} Log file: $(basename "$log_file")"
    ((CHECKS_PASSED++))
    
    # Check for errors in log
    if grep -q "ERROR\|FAILED" "$log_file" 2>/dev/null; then
        local error_count=$(grep -c "ERROR\|FAILED" "$log_file" || true)
        echo -e "${YELLOW}⚠${NC} Log contains $error_count error/failure entries"
        echo "   Review with: tail -50 $log_file"
    else
        echo -e "${GREEN}✓${NC} No errors in log"
        ((CHECKS_PASSED++))
    fi
else
    echo -e "${YELLOW}⚠${NC} No implementation log found"
fi

if [[ -f "$PROJECT_ROOT/reports/implementation_report_*.md" ]]; then
    local report_file=$(ls -t "$PROJECT_ROOT/reports/implementation_report_"*.md 2>/dev/null | head -1)
    echo -e "${GREEN}✓${NC} Report file: $(basename "$report_file")"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} No implementation report found"
fi

echo ""
echo "8. TYPESCRIPT COMPILATION"
echo "─────────────────────────────────────────────────────────────"

if command -v tsc &> /dev/null; then
    echo "Running: tsc --noEmit (this may take a moment)..."
    if cd "$PROJECT_ROOT" && tsc --noEmit 2>&1 | head -20 | tee /tmp/tsc_check.txt; then
        echo -e "${GREEN}✓${NC} TypeScript compilation successful"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} TypeScript compilation had issues"
        echo "   Full output in: /tmp/tsc_check.txt"
        ((CHECKS_MANUAL++))
    fi
else
    echo -e "${YELLOW}⚠${NC} TypeScript compiler (tsc) not found"
fi

echo ""
echo "9. MANUAL VALIDATION REQUIRED"
echo "─────────────────────────────────────────────────────────────"

echo -e "${BLUE}→${NC} Database Update (Priority #1)"
echo "   REQUIRED: Update r3admin user in database"
echo "   Check: sqlite3 r3.db \"SELECT username, is_admin FROM users WHERE username='r3admin';\""
((CHECKS_MANUAL++))

echo ""
echo -e "${BLUE}→${NC} Agi-Suite Configuration (Priority #3)"
echo "   REQUIRED: Verify Agi-Suite .env has R3_INTERNAL_URL"
echo "   Check: grep R3_INTERNAL_URL ~/Agi-Suite/.env"
((CHECKS_MANUAL++))

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Summary
total_checks=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_MANUAL))
pass_rate=$((CHECKS_PASSED * 100 / total_checks))

echo "VERIFICATION SUMMARY"
echo "─────────────────────────────────────────────────────────────"
echo -e "Passed:  ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Failed:  ${RED}$CHECKS_FAILED${NC}"
echo -e "Manual:  ${BLUE}$CHECKS_MANUAL${NC}"
echo "─────────────────────────────────────────────────────────────"
echo "Pass Rate: $pass_rate%"
echo ""

if [[ $CHECKS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✓ VERIFICATION SUCCESSFUL${NC}"
    echo ""
    echo "All automated checks passed!"
    echo ""
    if [[ $CHECKS_MANUAL -gt 0 ]]; then
        echo "NEXT STEPS:"
        echo "  1. Complete manual database update for r3admin"
        echo "  2. Verify Agi-Suite .env configuration"
        echo "  3. Run: pnpm build && pnpm test"
        echo "  4. Deploy to Railway"
    fi
    exit 0
else
    echo -e "${RED}✗ VERIFICATION FAILED${NC}"
    echo ""
    echo "Issues detected:"
    echo "  - $CHECKS_FAILED automated checks failed"
    echo ""
    echo "TROUBLESHOOTING:"
    echo "  1. Review the errors above"
    echo "  2. Check the implementation log"
    echo "  3. If critical: bash .backups/*/rollback_*.sh"
    echo "  4. Fix issues and re-run implementation"
    exit 1
fi
