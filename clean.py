#!/usr/bin/env python3

import argparse
import shutil
from pathlib import Path
from fnmatch import fnmatch

# =========================
# SAFE RULES
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

# NEVER TOUCH THESE
EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    ".env",
}

# =========================
# SAFETY CHECKS
# =========================

def is_safe_root(root: Path) -> bool:
    # Prevent catastrophic runs
    forbidden = Path("/")

    if root == forbidden:
        return False

    return True


def is_python_project(root: Path) -> bool:
    return (root / "pyproject.toml").exists() or (root / "setup.py").exists()


# =========================
# MATCHING
# =========================

def match_any(name: str, patterns: list[str]) -> bool:
    return any(fnmatch(name, p) for p in patterns)


def should_skip(path: Path) -> bool:
    return any(part in EXCLUDED_DIRS for part in path.parts)


# =========================
# COLLECT TARGETS FIRST (IMPORTANT FIX)
# =========================

def collect_targets(root: Path):
    dirs_to_delete = []
    files_to_delete = []

    for path in root.rglob("*"):

        if should_skip(path):
            continue

        # directories
        if path.is_dir():
            if match_any(path.name, DIR_PATTERNS):
                dirs_to_delete.append(path)

        # files
        elif path.is_file():
            if match_any(path.name, FILE_PATTERNS):
                files_to_delete.append(path)

    # Sort deepest-first so removal is safe
    dirs_to_delete.sort(key=lambda p: len(p.parts), reverse=True)

    return dirs_to_delete, files_to_delete


# =========================
# DELETE SAFE
# =========================

def safe_delete(path: Path, dry_run: bool):
    try:
        if dry_run:
            print(f"[DRY-RUN] {path}")
            return

        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()

        print(f"Removed: {path}")

    except Exception as e:
        print(f"Failed: {path} -> {e}")


# =========================
# MAIN CLEANER
# =========================

def clean(root: Path, dry_run: bool):

    dirs, files = collect_targets(root)

    print("\n🧹 CLEANUP PLAN")
    print(f"Directories: {len(dirs)}")
    print(f"Files: {len(files)}\n")

    # Show preview (important safety feature)
    for d in dirs[:20]:
        print(f"[DIR ] {d}")
    for f in files[:20]:
        print(f"[FILE] {f}")

    if len(dirs) > 20 or len(files) > 20:
        print("... (truncated preview)\n")

    confirm = input("\nProceed? (y/N): ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        return

    # Delete files first
    for f in files:
        safe_delete(f, dry_run)

    # Then directories
    for d in dirs:
        safe_delete(d, dry_run)

    print("\n✅ Cleanup complete")


# =========================
# CLI
# =========================

def main():
    parser = argparse.ArgumentParser(description="Safe Python cleanup tool")

    parser.add_argument("--path", default=".")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes", action="store_true")

    args = parser.parse_args()

    root = Path(args.path).resolve()

    # SAFETY GATE #1
    if not is_safe_root(root):
        print("❌ Refusing to run on filesystem root")
        return

    # SAFETY GATE #2
    if not is_python_project(root):
        print("⚠️ Warning: Not a detected Python project")

    print(f"📁 Target: {root}")

    if args.yes:
        # bypass confirmation only AFTER preview is still shown
        pass

    clean(root, args.dry_run)


if __name__ == "__main__":
    main()