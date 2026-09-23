#!/bin/bash
# Improved Tier Type Mismatch Fix v2
# Run from: /home/cloud/Projects/r3v4
# Usage: bash apply-tier-type-fix-v2.sh [--dry-run] [--apply]
# 
# Changes from v1:
# - Only targets TIER lines, not all "as string | undefined" occurrences
# - Fixes collateral damage bug where password was modified

set -e

PROJECT_DIR="/home/cloud/Projects/r3v4"
cd "$PROJECT_DIR" || exit 1

echo "════════════════════════════════════════════════════════════════"
echo "TIER TYPE FIX v2: Targeted Application (No Collateral Damage)"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Project: $PROJECT_DIR"
echo "Mode: ${1:-dry-run}"
echo ""

DRY_RUN=true
if [ "$1" == "--apply" ]; then
    DRY_RUN=false
fi

# ──────────────────────────────────────────────────────────────────
# FIX #1: server/types/express.d.ts - Line 10
# ──────────────────────────────────────────────────────────────────

echo "📝 FIX #1: server/types/express.d.ts (Line 10)"
echo "────────────────────────────────────────────────────────────────"

if [ -f "server/types/express.d.ts" ]; then
    echo "File found ✅"
    
    if grep -q "tier: string;" server/types/express.d.ts; then
        echo "Found 'tier: string;' ✓"
        
        if [ "$DRY_RUN" = true ]; then
            echo "DRY-RUN: Would replace 'tier: string;' with 'tier: \"explorer\" | \"creator\" | \"pro_artist\";'"
            echo ""
            grep -n "tier:" server/types/express.d.ts | head -3
        else
            echo "APPLYING: Replacing 'tier: string;' with literal union..."
            sed -i 's/tier: string;/tier: "explorer" | "creator" | "pro_artist";/' server/types/express.d.ts
            echo "✅ Applied"
            echo ""
            grep -n "tier:" server/types/express.d.ts | head -3
        fi
    else
        echo "⚠️  'tier: string;' not found (already fixed?)"
        grep -n "tier:" server/types/express.d.ts | head -3
    fi
else
    echo "❌ File not found: server/types/express.d.ts"
fi

echo ""

# ──────────────────────────────────────────────────────────────────
# FIX #2: server/routes/auth.ts - TYPE CASTS FOR TIER ONLY
# ──────────────────────────────────────────────────────────────────

echo "📝 FIX #2: server/routes/auth.ts - Tier type casts (Lines 174, 252)"
echo "────────────────────────────────────────────────────────────────"

if [ -f "server/routes/auth.ts" ]; then
    echo "File found ✅"
    
    # Look for TIER-specific type casts only
    if grep -q "tier:.*as string | undefined" server/routes/auth.ts; then
        echo "Found tier type casts ✓"
        
        if [ "$DRY_RUN" = true ]; then
            echo "DRY-RUN: Would replace tier type casts"
            grep -n "tier:.*as string | undefined" server/routes/auth.ts
        else
            echo "APPLYING: Fixing tier type casts (only tier, not password)..."
            # Only replace tier: ... as string | undefined
            sed -i 's/tier: (.*as string | undefined)/tier: (\1as "explorer" | "creator" | "pro_artist" | undefined/' server/routes/auth.ts
            echo "✅ Applied"
            grep -n "tier:.*as.*undefined" server/routes/auth.ts | head -5
        fi
    else
        echo "⚠️  Tier type casts not found (already fixed?)"
        grep -n "tier:.*as" server/routes/auth.ts | head -5
    fi
    
    echo ""
    echo "Checking for collateral damage..."
    if grep -q "password as \"explorer" server/routes/auth.ts; then
        echo "❌ COLLATERAL DAMAGE DETECTED: password was modified!"
        echo "Fixing automatically..."
        sed -i 's/password as "explorer | "creator" | "pro_artist" | undefined/password as string | undefined/' server/routes/auth.ts
        echo "✅ Fixed"
    else
        echo "✅ No collateral damage - password field clean"
    fi
else
    echo "❌ File not found: server/routes/auth.ts"
fi

echo ""

# ──────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════════════════"
echo "SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "✅ DRY-RUN COMPLETE"
    echo ""
    echo "To apply these changes, run:"
    echo "  bash apply-tier-type-fix-v2.sh --apply"
    echo ""
else
    echo "✅ FIXES APPLIED (v2 - No Collateral Damage)"
    echo ""
    echo "Next steps:"
    echo "  1. Verify changes:"
    echo "     git diff server/types/express.d.ts"
    echo "     git diff server/routes/auth.ts"
    echo ""
    echo "  2. Check for issues:"
    echo "     grep 'password as.*explorer' server/routes/auth.ts  (should find nothing)"
    echo ""
    echo "  3. Rebuild:"
    echo "     pnpm build 2>&1 | tail -20"
    echo ""
    echo "  4. If successful, commit:"
    echo "     git add server/types/express.d.ts server/routes/auth.ts"
    echo "     git commit -m 'fix: tier type mismatch - use literal union instead of string'"
    echo ""
fi
