#!/usr/bin/env python3

import argparse
import shutil
from pathlib import Path

# =========================
# SAFE DEFAULT TARGETS
# =========================

DIR_PATTERNS = [
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "build",
    "dist",
    "*.egg-info",
]

FILE_PATTERNS = [
    "*.pyc",
    "*.pyo",
    "*.log",
    "*.tmp",
]

# =========================
# UTILITIES
# =========================

def is_python_project(root: Path) -> bool:
    return (root / "pyproject.toml").exists() or (root / "setup.py").exists()


def safe_remove(path: Path, dry_run: bool):
    try:
        if dry_run:
            print(f"[DRY-RUN] Would remove: {path}")
            return

        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()

        print(f"Removed: {path}")

    except Exception as e:
        print(f"Failed to remove {path}: {e}")


def match_patterns(path: Path, patterns: list[str]) -> bool:
    from fnmatch import fnmatch
    return any(fnmatch(path.name, p) for p in patterns)


# =========================
# CLEANUP LOGIC
# =========================

def clean(root: Path, dry_run: bool):
    print(f"📁 Scanning: {root}")

    # Walk filesystem once (safe + cross-platform)
    for path in root.rglob("*"):

        # Skip .git and hidden system dirs
        if ".git" in path.parts:
            continue

        # Remove matching directories
        if path.is_dir() and path.name in DIR_PATTERNS:
            safe_remove(path, dry_run)

        # Remove egg-info directories via pattern
        if path.is_dir() and match_patterns(path, ["*.egg-info"]):
            safe_remove(path, dry_run)

        # Remove matching files
        if path.is_file() and match_patterns(path, FILE_PATTERNS):
            safe_remove(path, dry_run)


# =========================
# CLI
# =========================

def main():
    parser = argparse.ArgumentParser(description="Safe Python project cleaner")

    parser.add_argument(
        "--path",
        default=".",
        help="Project root path (default: current directory)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without deleting"
    )

    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation prompt"
    )

    args = parser.parse_args()

    root = Path(args.path).resolve()

    # Safety check
    if not is_python_project(root):
        print("⚠️ Warning: Not a Python project (no pyproject.toml or setup.py found).")

    print(f"🧹 Cleanup target: {root}")

    if not args.yes and not args.dry_run:
        confirm = input("Continue? (y/N): ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            return

    clean(root, args.dry_run)

    print("✅ Done.")


if __name__ == "__main__":
    main()
