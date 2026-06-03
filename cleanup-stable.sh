#!/bin/bash
# ============================================================
# STEP B: STABLE TIER CLEANUP
# Removes empty files, archives fix scripts, consolidates backups
# ============================================================
set -euo pipefail

cd ~/Stable

echo "🔧 CLEANING STABLE TIER"
echo "======================="

# 1. REMOVE EMPTY FILES
echo ""
echo "1. Removing empty files..."
empty_files=(
    "DIAGNOSTIC_OUTPUT.txt"
    "HealthCheckResponse"
    "Sending"
    "should"
    "qs"
    "tsc"
    "vitest"
    "workspace@0.0.0"
    "esbuild"
    "eslint"
    "express"
    "js-cookie"
    "react-use"
    "drizzle-kit"
    "pnpm"
    "ui-modernization-phase1"
)
for f in "${empty_files[@]}"; do
    if [ -f "$f" ] && [ ! -s "$f" ]; then
        rm -f "$f"
        echo "   ✅ Removed: $f"
    fi
done

# 2. REMOVE EMPTY DIRECTORIES
echo ""
echo "2. Removing empty directories..."
empty_dirs=(
    "db/schema"
    "esbuild"
    "eslint"
    "express"
    "js-cookie"
    "react-use"
    "drizzle-kit"
    "services"
)
for d in "${empty_dirs[@]}"; do
    if [ -d "$d" ] && [ -z "$(ls -A "$d" 2>/dev/null)" ]; then
        rmdir "$d"
        echo "   ✅ Removed: $d"
    fi
done

# 3. ARCHIVE FIX SCRIPTS
echo ""
echo "3. Archiving fix scripts..."
mkdir -p archive/fix-scripts
for pattern in fix_*.py fix_*.sh fix-*.sh patch_*.py patch-*.sh apply-*.sh run_all_*.sh r3-*.sh r3_*.sh r3*.py asi-*.sh asi_*.py c03_*.sh final-*.sh update-*.sh; do
    for f in $pattern; do
        if [ -f "$f" ]; then
            mv "$f" archive/fix-scripts/ 2>/dev/null || true
            echo "   ✅ Archived: $f"
        fi
    done
done

# 4. CONSOLIDATE BACKUPS
echo ""
echo "4. Consolidating backups..."
mkdir -p archive/backups
for pattern in *.bak* *.BACKUP* .bak* .fix-backup-* .r3-patch-backups-* .r3-cleanup-manifest-* .dep-remediation-backup-* .docs-backup-* .scripts-archived .config .audio_hook_backup_*; do
    for f in $pattern; do
        if [ -f "$f" ] || [ -d "$f" ]; then
            mv "$f" archive/backups/ 2>/dev/null || true
            echo "   ✅ Archived: $f"
        fi
    done
done

# 5. HANDLE DOCKERFILE VERSIONS
echo ""
echo "5. Consolidating Dockerfile versions..."
mkdir -p archive/docker
for f in Dockerfile.bak.*; do
    [ -f "$f" ] && mv "$f" archive/docker/ 2>/dev/null || true
done

# 6. HANDLE PACKAGE.JSON BACKUPS
echo ""
echo "6. Consolidating package.json backups..."
mkdir -p archive/package-json
for f in package.json.bak* package.json.BACKUP; do
    [ -f "$f" ] && mv "$f" archive/package-json/ 2>/dev/null || true
done

# 7. HANDLE TSCONFIG BACKUPS
echo ""
echo "7. Consolidating tsconfig backups..."
mkdir -p archive/tsconfig
for f in tsconfig.bak.* tsconfig.json.bak*; do
    [ -f "$f" ] && mv "$f" archive/tsconfig/ 2>/dev/null || true
done

# 8. HANDLE LOCKFILE BACKUPS
echo ""
echo "8. Consolidating lockfile backups..."
mkdir -p archive/lockfiles
for f in pnpm-lock.yaml.BACKUP; do
    [ -f "$f" ] && mv "$f" archive/lockfiles/ 2>/dev/null || true
done

# 9. HANDLE AUDIT ARTIFACTS
echo ""
echo "9. Moving audit artifacts..."
mkdir -p archive/audits
for f in _full_engine_audit.txt asi_hygiene_audit_report.md audit_r3.txt human_review_queue.txt; do
    [ -f "$f" ] && mv "$f" archive/audits/ 2>/dev/null || true
done

# 10. SECRETS HANDLING
echo ""
echo "10. Handling secrets..."
if [ -d "secrets" ]; then
    if ! grep -q "secrets/" .gitignore 2>/dev/null; then
        echo "secrets/" >> .gitignore
        echo "   ✅ Added secrets/ to .gitignore"
    fi
fi

# 11. VERIFY
echo ""
echo "11. Verifying cleanup..."
echo "   Remaining root files: $(ls -1 | wc -l)"
echo "   Archive size: $(du -sh archive/ 2>/dev/null | cut -f1)"

echo ""
echo "======================="
echo "✅ STABLE TIER CLEANED"
echo ""
echo "NEXT: Build and test"
echo "  cd ~/Stable && pnpm install && pnpm build"
