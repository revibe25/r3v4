#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# Resolve repo root regardless of execution dir
# ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FILE="$REPO_ROOT/client/src/features/loopstation/hooks/useLoopStation505.ts"
BACKUP="$FILE.bak.$(date +%s)"

echo "🔧 LoopStation505 safe fix script starting..."
echo "📍 Repo root: $REPO_ROOT"
echo "📄 Target file: $FILE"x
