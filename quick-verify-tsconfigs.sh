#!/bin/bash
# Quick check: What's actually in the tsconfig.json files?

cd ~/r3v4

echo "=========================================="
echo "TSCONFIG.JSON VERIFICATION"
echo "=========================================="
echo ""

for pkg in packages/llpte-signal packages/llpte-core packages/llpte-ai packages/llpte-execution packages/llpte-transition-graph packages/llpte-adapters; do
    echo "[$pkg]"
    
    if [ ! -f "$pkg/tsconfig.json" ]; then
        echo "  ❌ No tsconfig.json"
        echo ""
        continue
    fi
    
    echo "  compilerOptions.baseUrl:"
    jq '.compilerOptions.baseUrl // "NOT SET"' "$pkg/tsconfig.json"
    
    echo "  compilerOptions.composite:"
    jq '.compilerOptions.composite // "NOT SET"' "$pkg/tsconfig.json"
    
    echo "  compilerOptions.paths:"
    jq '.compilerOptions.paths // "NOT SET"' "$pkg/tsconfig.json"
    
    echo ""
done

echo "=========================================="
echo "ROOT TSCONFIG REFERENCES"
echo "=========================================="
echo ""

if [ -f "tsconfig.json" ]; then
    echo "Root references:"
    jq '.references[].path' tsconfig.json
else
    echo "❌ No root tsconfig.json"
fi

echo ""
echo "=========================================="
echo "CHECK: Does shared/src/auto-level.types.ts exist?"
echo "=========================================="
echo ""

if [ -f "shared/src/auto-level.types.ts" ]; then
    echo "✅ EXISTS"
    echo "First 5 lines:"
    head -5 shared/src/auto-level.types.ts
else
    echo "❌ NOT FOUND"
    echo "Files in shared/src:"
    ls -la shared/src/ | grep "\.ts$" || echo "  (none)"
fi
