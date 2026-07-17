#!/bin/bash
# Audit the actual repo structure to find where shared/auto-level.types lives

cd ~/r3v4

echo "=========================================="
echo "STRUCTURE AUDIT: Finding auto-level.types"
echo "=========================================="
echo ""

# Find all .ts files named auto-level* anywhere
echo "[1] Search for auto-level.* files anywhere in repo:"
find . -name "*auto-level*" -type f 2>/dev/null | grep -v node_modules | head -20

# Check what directories exist
echo ""
echo "[2] Does 'shared/' directory exist?"
if [ -d "shared" ]; then
    echo "  ✓ EXISTS"
    echo "  Contents:"
    ls -la shared/
    echo ""
    echo "  subdirectories:"
    ls -d shared/*/ 2>/dev/null || echo "    (none)"
else
    echo "  ✗ NOT FOUND"
fi

# Check what other root-level directories exist
echo ""
echo "[3] Root-level directories:"
ls -d */ | head -15

# Look for TypeScript type definitions (.d.ts)
echo ""
echo "[4] Search for AUTO_LEVEL_CONSTANTS anywhere:"
grep -r "AUTO_LEVEL_CONSTANTS" . --include="*.ts" --include="*.js" 2>/dev/null | grep -v node_modules | head -10

# Search for where auto-level types are defined
echo ""
echo "[5] Search for 'auto-level' in package.json files:"
grep -r "auto-level" . --include="package.json" 2>/dev/null

# Check all tsconfig.json files to see what they reference
echo ""
echo "[6] All paths references in tsconfigs:"
find . -name "tsconfig.json" -type f 2>/dev/null | grep -v node_modules | while read f; do
    echo "  [$f]"
    jq '.compilerOptions.paths // empty' "$f" 2>/dev/null | head -5
done
