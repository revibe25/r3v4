#!/bin/bash
################################################################################
# R3 v4 Priority #1-4 - DIRECT Implementation Script
# This script applies changes directly without complex pattern matching
################################################################################

set -euo pipefail

echo "════════════════════════════════════════════════════════════════════════"
echo "  R3 v4 Priority #1-4 DIRECT Implementation"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# Configuration
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${PROJECT_ROOT}/.backups/${TIMESTAMP}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create backup directory
mkdir -p "$BACKUP_DIR"

backup_file() {
    local file="$1"
    local backup_name="${BACKUP_DIR}/$(echo "$file" | tr '/' '_')"
    cp "$file" "$backup_name"
    echo "  Backed up: $file → $backup_name"
}

# ═══════════════════════════════════════════════════════════════════════════
# PRIORITY #1: Admin Bypass in requireTier()
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "── PRIORITY #1: Auth System & Admin Bypass ──"
echo ""

DAW_FILE="server/routers/daw.ts"

if [[ ! -f "$DAW_FILE" ]]; then
    echo -e "${RED}✗ File not found: $DAW_FILE${NC}"
    echo "Cannot apply Priority #1"
    exit 1
fi

# Check if admin bypass already exists
if grep -q "ctx.user?.is_admin" "$DAW_FILE"; then
    echo -e "${GREEN}✓ Admin bypass already exists in requireTier()${NC}"
else
    echo "  Adding admin bypass to requireTier()..."
    backup_file "$DAW_FILE"

    # Use Python for reliable multi-line insertion
    python3 << 'PYEOF'
import re

file_path = "server/routers/daw.ts"

with open(file_path, 'r') as f:
    content = f.read()

# Find the requireTier function and add admin bypass after the opening brace
pattern = r'(function requireTier\([^)]+\)\s*\{)'

if re.search(pattern, content):
    def replacement(m):
        return m.group(1) + """
  // ADMIN BYPASS: Admins have unrestricted access to all features
  if (ctx.user?.is_admin) {
    return;  // Skip all tier checks for admins
  }"""

    new_content = re.sub(pattern, replacement, content, count=1)
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("  Admin bypass added successfully")
else:
    print("  ERROR: Could not find requireTier function pattern")
    exit(1)
PYEOF

    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✓ Priority #1 applied successfully${NC}"
    else
        echo -e "${RED}✗ Priority #1 failed${NC}"
        exit 1
    fi
fi

# Verify
if grep -q "ctx.user?.is_admin" "$DAW_FILE"; then
    echo -e "${GREEN}✓ Verified: Admin bypass is in place${NC}"
else
    echo -e "${RED}✗ Verification failed${NC}"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# PRIORITY #2-4: Validation Only
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "── PRIORITY #2: Frontend Live Data Wiring ──"
echo ""

HOOKS_FILE="client/src/hooks/useMixSuggestions.ts"
DAW_PAGE="client/src/pages/collaborative-daw-pro.tsx"

if [[ -f "$HOOKS_FILE" ]]; then
    if grep -q "latencyMs" "$HOOKS_FILE"; then
        echo -e "${GREEN}✓ latencyMs found in useMixSuggestions${NC}"
    else
        echo -e "${YELLOW}⚠ latencyMs not found in useMixSuggestions${NC}"
    fi
else
    echo -e "${YELLOW}⚠ File not found: $HOOKS_FILE${NC}"
fi

if [[ -f "$DAW_PAGE" ]]; then
    if grep -q "latencyMs" "$DAW_PAGE" || grep -q "llpteLatency" "$DAW_PAGE"; then
        echo -e "${GREEN}✓ Latency wiring found in collaborative-daw-pro${NC}"
    else
        echo -e "${YELLOW}⚠ Latency wiring not found in collaborative-daw-pro${NC}"
    fi
else
    echo -e "${YELLOW}⚠ File not found: $DAW_PAGE${NC}"
fi

echo ""
echo "── PRIORITY #3: Agi-Suite Integration ──"
echo ""

ROUTES_FILE="server/routes.ts"
INTERNAL_FILE="server/routes/internal.ts"

if [[ -f "$ROUTES_FILE" ]]; then
    if grep -q "internalRouter" "$ROUTES_FILE"; then
        echo -e "${GREEN}✓ internalRouter found in routes.ts${NC}"
    else
        echo -e "${YELLOW}⚠ internalRouter not found in routes.ts${NC}"
    fi
else
    echo -e "${YELLOW}⚠ File not found: $ROUTES_FILE${NC}"
fi

if [[ -f "$INTERNAL_FILE" ]]; then
    if grep -q "/metrics/time-savings" "$INTERNAL_FILE"; then
        echo -e "${GREEN}✓ /metrics/time-savings endpoint found${NC}"
    else
        echo -e "${YELLOW}⚠ /metrics/time-savings endpoint not found${NC}"
    fi
else
    echo -e "${YELLOW}⚠ File not found: $INTERNAL_FILE${NC}"
fi

AGI_ENV="$HOME/Agi-Suite/.env"
if [[ -f "$AGI_ENV" ]]; then
    if grep -q "R3_INTERNAL_URL=http://localhost:3001" "$AGI_ENV"; then
        echo -e "${GREEN}✓ Agi-Suite .env configured correctly${NC}"
    else
        echo -e "${YELLOW}⚠ Agi-Suite .env may need R3_INTERNAL_URL=http://localhost:3001${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Agi-Suite .env not found${NC}"
fi

echo ""
echo "── PRIORITY #4: Security Patch ──"
echo ""

if [[ -f "package.json" ]]; then
    if python3 -m json.tool package.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓ package.json is valid JSON${NC}"
    else
        echo -e "${RED}✗ package.json is invalid JSON${NC}"
    fi

    if grep -q '"overrides"' package.json; then
        echo -e "${GREEN}✓ pnpm.overrides section found${NC}"
    else
        echo -e "${YELLOW}⚠ No pnpm.overrides found${NC}"
    fi
else
    echo -e "${RED}✗ package.json not found${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  IMPLEMENTATION SUMMARY"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Backup directory: $BACKUP_DIR"
echo ""
echo "Changes made:"
echo "  • server/routers/daw.ts - Admin bypass added to requireTier()"
echo ""
echo "Manual actions still required:"
echo "  1. Update r3admin in database:"
echo "     UPDATE users SET is_admin = true, subscription_tier = 'pro_artist'"
echo "     WHERE username = 'r3admin';"
echo ""
echo "  2. Ensure Agi-Suite .env has:"
echo "     R3_INTERNAL_URL=http://localhost:3001"
echo ""
echo "Next steps:"
echo "  pnpm build"
echo "  pnpm test"
echo ""
