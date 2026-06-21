#!/bin/bash
################################################################################
# R3 v4 Priority #1-4 - SURGICAL Patch for r3v's exact codebase
# This script is tailored to the actual files found in ~/Stable
################################################################################

set -euo pipefail

echo "════════════════════════════════════════════════════════════════════════"
echo "  R3 v4 Priority #1-4 SURGICAL Patch"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./.backups/${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

backup() {
    cp "$1" "${BACKUP_DIR}/$(echo "$1" | tr '/' '_')"
    echo "  Backed up: $1"
}

# ═══════════════════════════════════════════════════════════════════════════
# PRIORITY #1: Fix requireTier() - Add user to ctx type + admin bypass
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "── PRIORITY #1: Auth System & Admin Bypass ──"
echo ""

DAW_FILE="server/routers/daw.ts"

if [[ ! -f "$DAW_FILE" ]]; then
    echo -e "${RED}✗ $DAW_FILE not found${NC}"
    exit 1
fi

# Check if already patched
if grep -q "ctx.user?.is_admin" "$DAW_FILE"; then
    echo -e "${GREEN}✓ Admin bypass already exists${NC}"
else
    echo "  Patching requireTier()..."
    backup "$DAW_FILE"

    python3 << 'PYEOF'
import re

file_path = "server/routers/daw.ts"

with open(file_path, 'r') as f:
    content = f.read()

# The ACTUAL pattern in r3v's file:
# function requireTier(ctx: { subscription?: { tier: string } | null }, minTier: Tier): void {
#   const ORDER: Tier[] = ['explorer','creator','pro_artist'];

old_sig = "function requireTier(ctx: { subscription?: { tier: string } | null }, minTier: Tier): void {"

new_sig = """function requireTier(ctx: { user?: { is_admin?: boolean } | null; subscription?: { tier: string } | null }, minTier: Tier): void {
  // ADMIN BYPASS: Admins have unrestricted access to all features
  if (ctx.user?.is_admin) {
    return;  // Skip all tier checks for admins
  }"""

if old_sig not in content:
    print("ERROR: Could not find exact requireTier signature")
    print("Searching for alternative patterns...")

    # Try regex match for flexibility
    pattern = r'function requireTier\(ctx:\s*\{\s*subscription\?\?:\s*\{\s*tier:\s*string\s*\}\s*\|\s*null\s*\},\s*minTier:\s*Tier\):\s*void\s*\{'
    if not re.search(pattern, content):
        print("ERROR: Regex also failed to match requireTier")
        exit(1)

    # Replace using regex
    def repl(m):
        return """function requireTier(ctx: { user?: { is_admin?: boolean } | null; subscription?: { tier: string } | null }, minTier: Tier): void {
  // ADMIN BYPASS: Admins have unrestricted access to all features
  if (ctx.user?.is_admin) {
    return;  // Skip all tier checks for admins
  }"""

    content = re.sub(pattern, repl, content, count=1)
else:
    content = content.replace(old_sig, new_sig, 1)

with open(file_path, 'w') as f:
    f.write(content)

print("  requireTier() patched successfully")
PYEOF

    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✓ Priority #1 applied${NC}"
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

# Also verify the type signature was updated
if grep -q "user?: { is_admin?: boolean }" "$DAW_FILE"; then
    echo -e "${GREEN}✓ Verified: ctx type includes user.is_admin${NC}"
else
    echo -e "${YELLOW}⚠ Warning: ctx type may not include user.is_admin${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PRIORITY #3: Check/fix internalRouter in routes.ts
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "── PRIORITY #3: Agi-Suite Integration ──"
echo ""

ROUTES_FILE="server/routes.ts"
INTERNAL_FILE="server/routes/internal.ts"

if [[ -f "$ROUTES_FILE" ]]; then
    if grep -q "internalRouter" "$ROUTES_FILE"; then
        echo -e "${GREEN}✓ internalRouter found in routes.ts${NC}"
    else
        echo -e "${YELLOW}⚠ internalRouter NOT found in routes.ts${NC}"
        echo "  This needs to be added manually. The dry-run failed because"
        echo "  internalRouter is not mounted in your routes."
        echo ""
        echo "  Add this to server/routes.ts:"
        echo "    import { internalRouter } from './routes/internal';"
        echo "    app.use('/internal', internalRouter);"
    fi
else
    echo -e "${RED}✗ server/routes.ts not found${NC}"
fi

if [[ -f "$INTERNAL_FILE" ]]; then
    if grep -q "/metrics/time-savings" "$INTERNAL_FILE"; then
        echo -e "${GREEN}✓ /metrics/time-savings endpoint found${NC}"
    else
        echo -e "${YELLOW}⚠ /metrics/time-savings not found in internal.ts${NC}"
    fi
else
    echo -e "${YELLOW}⚠ server/routes/internal.ts not found${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PRIORITY #2 & #4: Validation only
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "── PRIORITY #2: Frontend Live Data Wiring ──"
echo ""

HOOKS_FILE="client/src/hooks/useMixSuggestions.ts"
DAW_PAGE="client/src/pages/collaborative-daw-pro.tsx"

if [[ -f "$HOOKS_FILE" ]] && grep -q "latencyMs" "$HOOKS_FILE"; then
    echo -e "${GREEN}✓ latencyMs found in useMixSuggestions${NC}"
else
    echo -e "${YELLOW}⚠ latencyMs not found${NC}"
fi

if [[ -f "$DAW_PAGE" ]] && (grep -q "latencyMs" "$DAW_PAGE" || grep -q "llpteLatency" "$DAW_PAGE"); then
    echo -e "${GREEN}✓ Latency wiring found in collaborative-daw-pro${NC}"
else
    echo -e "${YELLOW}⚠ Latency wiring not found${NC}"
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
else
    echo -e "${RED}✗ package.json not found${NC}"
fi

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  PATCH SUMMARY"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Backup directory: $BACKUP_DIR"
echo ""
echo "Changes made:"
echo "  • server/routers/daw.ts - Added user to ctx type + admin bypass"
echo ""
echo "Manual actions still required:"
echo "  1. Update r3admin in database:"
echo "     UPDATE users SET is_admin = true, subscription_tier = 'pro_artist'"
echo "     WHERE username = 'r3admin';"
echo ""
echo "  2. Check if internalRouter needs to be added to server/routes.ts"
echo "     (dry-run showed it's missing)"
echo ""
echo "  3. Ensure Agi-Suite .env has:"
echo "     R3_INTERNAL_URL=http://localhost:3001"
echo ""
echo "Next steps:"
echo "  pnpm build"
echo "  pnpm test"
echo ""
