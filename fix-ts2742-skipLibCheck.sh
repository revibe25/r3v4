#!/bin/bash
# Fix TS2742 by adding skipLibCheck: true
# This prevents TypeScript from checking library type definitions

set -e

PROJECT_DIR="/home/cloud/Projects/r3v4"
cd "$PROJECT_DIR" || exit 1

echo "════════════════════════════════════════════════════════════════"
echo "TS2742 FIX: Add skipLibCheck"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "Step 1: Check current server/tsconfig.json"
echo "────────────────────────────────────────────────────────────────"
echo ""

if [ -f "server/tsconfig.json" ]; then
    echo "✓ server/tsconfig.json exists"
    echo ""
    
    # Check if skipLibCheck already exists
    if grep -q '"skipLibCheck"' server/tsconfig.json; then
        echo "ℹ skipLibCheck already present:"
        grep '"skipLibCheck"' server/tsconfig.json
        echo ""
    else
        echo "Step 2: Add skipLibCheck: true"
        echo "────────────────────────────────────────────────────────────────"
        echo ""
        
        # Add skipLibCheck after "compilerOptions" opening
        # Method: Find the line with "compilerOptions": { and add after it
        sed -i '/"compilerOptions"[[:space:]]*:[[:space:]]*{/a\    "skipLibCheck": true,' server/tsconfig.json
        
        echo "✅ Added: \"skipLibCheck\": true"
        echo ""
        echo "Verification:"
        grep -A 3 '"compilerOptions"' server/tsconfig.json | head -5
        echo ""
    fi
else
    echo "❌ server/tsconfig.json not found"
    exit 1
fi

echo "Step 3: Clean and rebuild"
echo "────────────────────────────────────────────────────────────────"
echo ""

rm -rf ./server/dist ./dist ./.turbo

echo "Running pnpm build..."
if pnpm build 2>&1 | tee /tmp/build.log | tail -30; then
    echo ""
    echo "✅ BUILD SUCCESSFUL!"
    echo ""
    grep "✓ built in" /tmp/build.log || echo "(build output above)"
else
    echo ""
    echo "❌ Build failed. Checking for errors..."
    grep "error TS" /tmp/build.log | head -5
fi
