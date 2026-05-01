#!/usr/bin/env bash

set -euo pipefail

# =========================
# CONFIG
# =========================

PROJECT_ROOT="$(pwd)"

DRY_RUN=false
CONFIRM=true

# =========================
# FLAGS
# =========================

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --yes)
            CONFIRM=false
            ;;
    esac
done

# =========================
# SAFETY CHECK
# =========================

if [[ ! -f "$PROJECT_ROOT/pyproject.toml" && ! -f "$PROJECT_ROOT/setup.py" ]]; then
    echo "⚠️ Warning: No Python project detected in current directory."
    echo "Run this inside a Python project root."
    exit 1
fi

echo "📁 Cleaning Python project at: $PROJECT_ROOT"

# =========================
# DELETE FUNCTION (SAFE)
# =========================

safe_delete() {
    local target=$1

    if [[ -e "$target" ]]; then
        if [[ "$DRY_RUN" == true ]]; then
            echo "[DRY-RUN] Would remove: $target"
        else
            echo "Removing: $target"
            rm -rf "$target"
        fi
    fi
}

# =========================
# CONFIRMATION
# =========================

if [[ "$CONFIRM" == true && "$DRY_RUN" == false ]]; then
    read -p "⚠️ This will delete cache/build files. Continue? (y/N): " answer
    [[ "$answer" != "y" && "$answer" != "Y" ]] && exit 0
fi

# =========================
# CLEANUP TASKS
# =========================

echo "🧹 Cleaning Python caches..."

find . -type d -name "__pycache__" -exec bash -c 'safe_delete "$0"' {} \;
find . -type f -name "*.pyc" -exec bash -c 'safe_delete "$0"' {} \;
find . -type f -name "*.pyo" -exec bash -c 'safe_delete "$0"' {} \;

echo "🧪 Cleaning test & lint caches..."
safe_delete ".pytest_cache"
safe_delete ".mypy_cache"
safe_delete ".ruff_cache"
safe_delete ".coverage"

echo "📦 Cleaning build artifacts..."
safe_delete "build"
safe_delete "dist"
find . -type d -name "*.egg-info" -exec bash -c 'safe_delete "$0"' {} \;

echo "🗑️ Cleaning logs and temp files..."
find . -type f -name "*.log" -exec bash -c 'safe_delete "$0"' {} \;
find . -type f -name "*.tmp" -exec bash -c 'safe_delete "$0"' {} \;

echo "✅ Cleanup complete!"
