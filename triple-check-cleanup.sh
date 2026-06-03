#!/bin/bash
# ============================================================
# TRIPLE CHECK: Comprehensive cleanup across ALL tiers
# ============================================================
set -euo pipefail

echo "🔍 TRIPLE CHECK: Scanning all tiers for cleanup"
echo "================================================"

for TIER in Agent-OS Agi-Suite Stable; do
    if [ ! -d "$HOME/$TIER" ]; then
        echo "⚠️  $TIER not found, skipping"
        continue
    fi

    cd "$HOME/$TIER"
    echo ""
    echo "📁 SCANNING: $TIER"
    echo "-------------------"

    # 1. EMPTY FILES at root
    echo ""
    echo "1. Empty files at root:"
    find . -maxdepth 1 -type f -size 0 -print | while read f; do
        echo "   🗑️  $f"
        rm -f "$f"
    done

    # 2. EMPTY DIRECTORIES at root
    echo ""
    echo "2. Empty directories at root:"
    find . -maxdepth 1 -type d -empty -print | while read d; do
        echo "   🗑️  $d"
        rmdir "$d" 2>/dev/null || true
    done

    # 3. FIX SCRIPTS remaining at root
    echo ""
    echo "3. Fix scripts at root:"
    find . -maxdepth 1 -type f \( -name "fix_*" -o -name "patch_*" -o -name "apply_*" -o -name "run_all_*" -o -name "r3-*" -o -name "r3_*" -o -name "asi-*" -o -name "c03_*" -o -name "final-*" -o -name "update-*" \) -print | while read f; do
        echo "   🗑️  $f"
        mkdir -p archive/fix-scripts 2>/dev/null || true
        mv "$f" archive/fix-scripts/ 2>/dev/null || rm -f "$f"
    done

    # 4. BACKUP FILES at root
    echo ""
    echo "4. Backup files at root:"
    find . -maxdepth 1 \( -name "*.bak*" -o -name "*.BACKUP*" -o -name ".bak*" \) -print | while read f; do
        echo "   🗑️  $f"
        mkdir -p archive/backups 2>/dev/null || true
        mv "$f" archive/backups/ 2>/dev/null || rm -rf "$f"
    done

    # 5. COMPILED ARTIFACTS at root (Agent-OS specific)
    if [ "$TIER" = "Agent-OS" ]; then
        echo ""
        echo "5. Compiled artifacts at root:"
        find . -maxdepth 1 -type f \( -name "*.js" -o -name "*.js.map" -o -name "*.d.ts" -o -name "*.d.ts.map" \) ! -name "package.json" ! -name "package-lock.json" -print | while read f; do
            echo "   🗑️  $f"
            mkdir -p dist 2>/dev/null || true
            mv "$f" dist/ 2>/dev/null || rm -f "$f"
        done
    fi

    # 6. DUPLICATE FILES with (1) in name (Agent-OS specific)
    if [ "$TIER" = "Agent-OS" ]; then
        echo ""
        echo "6. Duplicate files:"
        find . -maxdepth 1 -type f -name "* (1).*" -print | while read f; do
            original=$(echo "$f" | sed 's/ (1)//')
            if [ -f "$original" ]; then
                echo "   🗑️  $f (duplicate of $original)"
                rm -f "$f"
            fi
        done
    fi

    # 7. NODE_MODULES CHECK
    echo ""
    echo "7. node_modules check:"
    if [ -d "node_modules" ]; then
        size=$(du -sh node_modules/ 2>/dev/null | cut -f1)
        echo "   📦 node_modules: $size"
    fi

    # 8. .ENV FILES CHECK
    echo ""
    echo "8. .env files check:"
    find . -maxdepth 1 -name ".env*" -type f -print | while read f; do
        echo "   ⚠️  $f exists (ensure no secrets committed)"
    done

    echo ""
    echo "✅ $TIER scan complete"
    echo "   Remaining root items: $(ls -1 | wc -l)"

done

echo ""
echo "================================================"
echo "✅ TRIPLE CHECK COMPLETE"
echo ""
echo "NEXT: Build all tiers"
echo "  cd ~/Agent-OS && pnpm run build"
echo "  cd ~/Agi-Suite && pnpm run build"
echo "  cd ~/Stable && pnpm run build"