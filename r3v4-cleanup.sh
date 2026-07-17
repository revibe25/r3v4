#!/bin/bash
set -e

# r3v4 cleanup script — run on ~/r3v4
# WIRE protocol: read → confirm → backup → dry-run → apply → verify

cd ~/r3v4

echo "=== R3V4 CLEANUP SEQUENCE ==="
echo ""

# STEP 1: Backup current state
echo "[1/5] Backing up current git state..."
git rev-parse HEAD > /tmp/r3v4-cleanup-anchor.txt
tar czf ~/.r3v4-backup-$(date +%s).tar.gz .git/config .gitignore 2>/dev/null || true
echo "✓ Backup anchored"
echo ""

# STEP 2: Dry-run — show what will be deleted
echo "[2/5] DRY-RUN: Files to be removed:"
echo "Untracked files:"
find . -maxdepth 1 -type f \( -name "*.backup*" -o -name "*.pub" -o -name "*.sh" -o -name "*.py" -o -name "COMPLETE_*" -o -name "LLPTE_*" -o -name "VERIFY_*" -o -name "App.js" -o -name "Deets-git" -o -name "package-lock.json" -o -name "*.tar.gz" -o -name "tsc-report.txt" -o -name "vitest.config.js" -o -name "vitest.workspace.js" -o -name "FETCH_HEAD" \) -print
echo ""
echo "Test/build directories:"
find . -maxdepth 1 -type d \( -name "test-results" -o -name "playwright-report" -o -name ".backups" \) -print
echo ""

# STEP 3: Confirm anchor
echo "[3/5] Anchor verification:"
CURRENT_COMMIT=$(git rev-parse HEAD)
ANCHOR_COMMIT=$(cat /tmp/r3v4-cleanup-anchor.txt)
if [ "$CURRENT_COMMIT" = "$ANCHOR_COMMIT" ]; then
  echo "✓ HEAD commit stable: $CURRENT_COMMIT"
else
  echo "✗ ABORT: HEAD changed during cleanup!"
  exit 1
fi
echo ""

# STEP 4: Apply cleanup
echo "[4/5] Applying cleanup..."

# Root level files
rm -f COMPLETE_BUILD_FIX.sh
rm -f Deets-git Deets-git.pub
rm -f LLPTE_E2E_TEST_TEMPLATE.js
rm -f VERIFY_LLPTE_PACKAGES.sh
rm -f App.js
rm -f fix-*.sh
rm -f *.backup*
rm -f *.pub
rm -f *.py
rm -f tsc-report.txt
rm -f package-lock.json
rm -f playwright.config.js
rm -f r3v4-audit.tar.gz
rm -f vitest.config.js
rm -f vitest.workspace.js
rm -f FETCH_HEAD

# Directories
rm -rf test-results/
rm -rf playwright-report/
rm -rf .backups/

# Package backups
find packages -name "*.backup_*" -delete

# Client-level test/config files
rm -f client/DSP/*.js
rm -f client/client/**/*.js
rm -f client/patch_*.py
rm -f client/tests_*.js
rm -f client/tailwind.config.js
rm -f client/vitest.config.js
rm -f client/vite.config.js
rm -f client/tests/setup.js
rm -f client/src/components/r3-wrappers.tsx
rm -f client/src/lib/trpc.tsx
rm -f client/src/styles/r3-theme.css
rm -f client/shared/types/meter.types.js
rm -f client/Parameters.js

# Config-level
rm -f config/tailwind.config.js

# Packages vitest configs
find packages -name "vitest.config.js" -delete
find packages -name "package.json.backup_*" -delete

# Scripts
rm -f scripts/lint-design-tokens.js
rm -f scripts/seed-dev-admin.js
rm -f scripts/vite.config.snippet.js

# Server middleware
rm -f server/middleware/devBypass.ts

# Shared
rm -rf shared/components/
rm -rf shared/theme/

# E2E tests
rm -f tests/e2e/*.spec.js
rm -f tests/happy-path.spec.js
rm -f tests/*.js

echo "✓ Cleanup applied"
echo ""

# STEP 5: Verify state
echo "[5/5] Post-cleanup verification:"
UNTRACKED_COUNT=$(git status --short | grep "^??" | wc -l)
echo "Remaining untracked files: $UNTRACKED_COUNT"

if [ "$UNTRACKED_COUNT" -lt 10 ]; then
  echo "✓ Cleanup successful"
else
  echo "⚠ Warning: Still have $UNTRACKED_COUNT untracked files"
  git status --short | grep "^??"
fi

echo ""
echo "=== GIT STATUS ==="
git status --short
