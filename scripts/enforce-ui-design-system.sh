#!/usr/bin/env bash
set -euo pipefail

echo "🧠 UI RECOVERY SYSTEM (Git authoritative restore)"
echo "================================================="

# ───────────────────────────────────────────────
# 1. Validate repo
# ───────────────────────────────────────────────

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)

if [[ -z "$REPO_ROOT" ]]; then
  echo "❌ Not inside a git repository"
  exit 1
fi

cd "$REPO_ROOT"

echo "📍 Repo root: $REPO_ROOT"

# ───────────────────────────────────────────────
# 2. Validate target directory state
# ───────────────────────────────────────────────

TARGET="client/src/components/ui"

if [[ ! -d "$TARGET" ]]; then
  echo "⚠️ UI folder missing — expected after deletion"
else
  echo "⚠️ UI folder exists — will be force-restored from Git"
fi

# ───────────────────────────────────────────────
# 3. Get last known good commit (explicit)
# ───────────────────────────────────────────────

GOOD_COMMIT=$(git log --pretty=format:"%H %s" -- "$TARGET" | grep "pre-ui-system-enforcement" | head -n 1 | cut -d' ' -f1)

if [[ -z "$GOOD_COMMIT" ]]; then
  echo "❌ Could not locate safe UI checkpoint commit"
  echo "Run: git log -- $TARGET"
  exit 1
fi

echo "📦 Restoring UI from commit: $GOOD_COMMIT"

# ───────────────────────────────────────────────
# 4. HARD RESTORE (authoritative)
# ───────────────────────────────────────────────

git checkout "$GOOD_COMMIT" -- "$TARGET"

# ───────────────────────────────────────────────
# 5. Verify restore integrity
# ───────────────────────────────────────────────

EXPECTED_FILES=$(git ls-tree -r --name-only "$GOOD_COMMIT" -- "$TARGET" | wc -l)
ACTUAL_FILES=$(find "$TARGET" -type f | wc -l)

echo "🔍 Expected files: $EXPECTED_FILES"
echo "🔍 Restored files: $ACTUAL_FILES"

if [[ "$ACTUAL_FILES" -lt "$EXPECTED_FILES" ]]; then
  echo "❌ Incomplete restore detected"
  exit 1
fi

# ───────────────────────────────────────────────
# 6. Ensure index exists
# ───────────────────────────────────────────────

if [[ ! -f "$TARGET/index.ts" ]]; then
  echo "🧩 Rebuilding index.ts export file"

  cat > "$TARGET/index.ts" << 'EOF'
// Auto-regenerated UI entry point

export * from './button';
export * from './card';
export * from './input';
export * from './dialog';
export * from './slider';
export * from './tabs';
export * from './alert';
export * from './badge';
export * from './label';
export * from './select';
export * from './separator';
export * from './scroll-area';
export * from './tooltip';
export * from './toast';
export * from './toaster';
export * from './collapsible-card';
EOF
fi

# ───────────────────────────────────────────────
# 7. Final sanity check
# ───────────────────────────────────────────────

echo "🧪 Running TypeScript check..."
npx tsc --noEmit || {
  echo "❌ TypeScript errors after restore"
  exit 1
}

echo "✅ UI system successfully restored from Git checkpoint"
