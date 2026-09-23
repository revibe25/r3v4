#!/bin/bash
# Automated Tier Type Mismatch Fix
# Run from: /home/cloud/Projects/r3v4
# Usage: bash apply-tier-type-fix.sh [--dry-run] [--apply]

set -e

PROJECT_DIR="/home/cloud/Projects/r3v4"
cd "$PROJECT_DIR" || exit 1

echo "════════════════════════════════════════════════════════════════"
echo "TIER TYPE FIX: Automated Application"
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
# FIX #2: server/routes/auth.ts - UserPayload interface (Line ~98)
# ──────────────────────────────────────────────────────────────────

echo "📝 FIX #2: server/routes/auth.ts - UserPayload interface"
echo "────────────────────────────────────────────────────────────────"

if [ -f "server/routes/auth.ts" ]; then
    echo "File found ✅"
    
    # Look for the UserPayload interface
    if grep -q "interface UserPayload" server/routes/auth.ts; then
        echo "Found UserPayload interface ✓"
        
        if grep -A 5 "interface UserPayload" server/routes/auth.ts | grep -q "tier: string;"; then
            echo "Found 'tier: string;' in UserPayload ✓"
            
            if [ "$DRY_RUN" = true ]; then
                echo "DRY-RUN: Would replace in UserPayload interface"
                grep -n "tier:" server/routes/auth.ts | grep -v "tierLabel\|tierPrice\|TierDefinition\|tier_" | head -5
            else
                echo "APPLYING: Fixing UserPayload interface..."
                # Find the line in UserPayload and replace
                sed -i '/interface UserPayload/,/^}/s/tier: string;/tier: "explorer" | "creator" | "pro_artist";/' server/routes/auth.ts
                echo "✅ Applied"
                grep -n "tier:" server/routes/auth.ts | grep "UserPayload" -A 5 | head -5 || grep -n "tier:" server/routes/auth.ts | head -5
            fi
        else
            echo "⚠️  'tier: string;' not found in UserPayload (already fixed?)"
        fi
    else
        echo "❌ UserPayload interface not found"
    fi
else
    echo "❌ File not found: server/routes/auth.ts"
fi

echo ""

# ──────────────────────────────────────────────────────────────────
# FIX #3 & #4: server/routes/auth.ts - Type casts (Lines ~174, ~252)
# ──────────────────────────────────────────────────────────────────

echo "📝 FIX #3 & #4: server/routes/auth.ts - Type casts"
echo "────────────────────────────────────────────────────────────────"

echo "Looking for type casts: 'as string | undefined'..."

if grep -q "as string | undefined" server/routes/auth.ts; then
    echo "Found type casts ✓"
    
    if [ "$DRY_RUN" = true ]; then
        echo "DRY-RUN: Would replace 'as string | undefined' with literal union"
        grep -n "as string | undefined" server/routes/auth.ts
    else
        echo "APPLYING: Fixing type casts..."
        sed -i 's/as string | undefined/as "explorer" | "creator" | "pro_artist" | undefined/g' server/routes/auth.ts
        echo "✅ Applied"
        grep -n "as.*undefined" server/routes/auth.ts | head -5
    fi
else
    echo "⚠️  Type casts not found (already fixed?)"
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
    echo "  bash apply-tier-type-fix.sh --apply"
    echo ""
else
    echo "✅ FIXES APPLIED"
    echo ""
    echo "Next steps:"
    echo "  1. Verify changes:"
    echo "     git diff server/types/express.d.ts"
    echo "     git diff server/routes/auth.ts"
    echo ""
    echo "  2. Rebuild:"
    echo "     pnpm build 2>&1 | tail -20"
    echo ""
    echo "  3. If successful, commit:"
    echo "     git add server/types/express.d.ts server/routes/auth.ts"
    echo "     git commit -m 'fix: tier type mismatch - use literal union instead of string'"
    echo ""
fi
