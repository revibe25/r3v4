#!/bin/bash
# ============================================================
# AGGRESSIVE CLEANUP: Remove all .bak, .bak_sweep, duplicate files
# ============================================================
set -euo pipefail

echo "🔪 AGGRESSIVE CLEANUP"
echo "====================="

for TIER in Agent-OS Agi-Suite Stable; do
    if [ ! -d "$HOME/$TIER" ]; then
        continue
    fi

    cd "$HOME/$TIER"
    echo ""
    echo "📁 CLEANING: $TIER"
    echo "-----------------"

    # 1. ALL .bak files (including .bak.2026*, .bak_sweep, .bak-2026*)
    echo ""
    echo "1. Removing ALL .bak files..."
    find . -type f \( -name "*.bak*" -o -name "*.bak_sweep" -o -name "*.bak-*" \) -print | while read f; do
        echo "   🗑️  $f"
        rm -f "$f"
    done

    # 2. ALL .BACKUP files
    echo ""
    echo "2. Removing ALL .BACKUP files..."
    find . -type f -name "*.BACKUP*" -print | while read f; do
        echo "   🗑️  $f"
        rm -f "$f"
    done

    # 3. ALL .OLD files
    echo ""
    echo "3. Removing ALL .OLD files..."
    find . -type f -name "*.OLD" -print | while read f; do
        echo "   🗑️  $f"
        rm -f "$f"
    done

    # 4. Remove .bak directories
    echo ""
    echo "4. Removing .bak directories..."
    find . -type d -name "*.bak*" -print | while read d; do
        echo "   🗑️  $d"
        rm -rf "$d"
    done

    # 5. Remove files with weird names (like 'how 21ee9d2 --name-only')
    echo ""
    echo "5. Removing files with weird names..."
    find . -maxdepth 1 -type f -name "how*" -print | while read f; do
        echo "   🗑️  $f"
        rm -f "$f"
    done
    find . -maxdepth 1 -type f -name "*ubmit*" -print | while read f; do
        echo "   🗑️  $f"
        rm -f "$f"
    done

    # 6. Remove .bak files in client/src/ (Stable specific)
    if [ "$TIER" = "Stable" ]; then
        echo ""
        echo "6. Cleaning Stable/client/src/ backups..."
        if [ -d "client/src" ]; then
            find client/src -type f \( -name "*.bak*" -o -name "*.bak_sweep" \) -print | while read f; do
                echo "   🗑️  $f"
                rm -f "$f"
            done
        fi
        if [ -d "client/src/components" ]; then
            find client/src/components -type f \( -name "*.bak*" -o -name "*.bak_sweep" \) -print | while read f; do
                echo "   🗑️  $f"
                rm -f "$f"
            done
        fi
    fi

    echo ""
    echo "✅ $TIER cleaned"

done

echo ""
echo "====================="
echo "✅ AGGRESSIVE CLEANUP COMPLETE"
echo ""
echo "Files removed:"
echo "  - All .bak, .bak_sweep, .bak-2026* files"
echo "  - All .BACKUP files"
echo "  - All .OLD files"
echo "  - Weird named files"
echo "  - Backup directories"
