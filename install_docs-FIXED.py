#!/usr/bin/env python3
"""
install_docs.py — FIXED VERSION
Installs or updates R3V4 documentation bundle with WIRE protocol safety

MEDIUM-1 BUG FIX:
  Before: --force flag showed "ADD" in plan for existing files, then silently overwrote
  After:  Plan now correctly shows "OVERWRITE" when target exists + --force is set

USAGE:
  python3 install_docs.py --dry-run   # Show plan without applying
  python3 install_docs.py --apply     # Execute with backups
  python3 install_docs.py              # Default: dry-run (safe)

FILES TO CUSTOMIZE:
  - SRC_DIR: source bundle location
  - DEST_DIR: deployment destination
  - ADD_FILES, REPLACE_FILES, PROTECT_GLOBS: file handling policy
"""

import sys
import os
import hashlib
import shutil
import signal
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple

# ═══════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════

# Handle SIGPIPE gracefully (fixes BrokenPipeError when piped to head/less) — LOW-2 fix
try:
    signal.signal(signal.SIGPIPE, signal.SIG_DFL)
except (AttributeError, ValueError):
    # Windows doesn't have SIGPIPE
    pass

SRC_DIR = Path.home() / "r3v4-docs-bundle"  # Source: where docs are built
DEST_DIR = Path.home() / "Stable"            # Destination: where to deploy
BACKUP_DIR = DEST_DIR / ".docs-backup"

# Files to ADD (new, don't overwrite)
ADD_FILES = [
    "WIRE.txt",
    "DEMO_CHECKLIST.md",
    "CLAUDE.md",
    "CLAUDE_local.md",
    "PRIORITIES.md",
    "README.md",
    "SESSION_2026-04-20.md",
    "SALE_PACKAGE.md",
    "dev/DEVELOPMENT.md",
    "dev/API.md",
    "dev/ARCHITECTURE.md",
    "dev/DEPLOYMENT.md",
]

# Files to REPLACE (overwrite if exists)
REPLACE_FILES = [
    "AI_MIXING.md",
    "TROUBLESHOOTING.md",
]

# Paths to protect (never delete, even if not in docs bundle)
PROTECT_GLOBS = [
    "PRD.pdf",
    "LLPTE/**",
    "infra/**",
    ".git/**",
    ".gitignore",
    ".docs-backup*",
    "node_modules/**",
    "*.log",
]

# ═══════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════

def sha256(file_path: Path) -> str:
    """Compute SHA256 hash of a file."""
    if not file_path.exists():
        return "N/A"
    return hashlib.sha256(file_path.read_bytes()).hexdigest()[:8]

def matches_glob(path: Path, globs: List[str]) -> bool:
    """Check if path matches any glob pattern."""
    for glob_pattern in globs:
        if path.match(glob_pattern):
            return True
    return False

def backup_tree(dest: Path, backup_dir: Path) -> Path:
    """Backup entire destination tree before modifications."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"full-backup-{timestamp}.tar.gz"
    
    # Use tar to preserve structure and metadata
    os.system(f"cd {dest.parent} && tar --exclude='.git' --exclude='node_modules' -czf {backup_path} {dest.name}/")
    
    return backup_path

def dry_run_plan(src: Path, dest: Path, force: bool = False) -> Tuple[List[str], List[str], List[str]]:
    """Generate a plan showing what will be added/replaced/skipped."""
    additions = []
    replacements = []
    skips = []
    
    for file_to_add in ADD_FILES:
        src_file = src / file_to_add
        dest_file = dest / file_to_add
        
        if not src_file.exists():
            skips.append(f"SKIP_MISSING {file_to_add} (source not found)")
            continue
        
        if dest_file.exists():
            if force:
                replacements.append(f"OVERWRITE {file_to_add} (exists, --force)")
            else:
                skips.append(f"SKIP_EXISTS {file_to_add} (exists, no --force)")
        else:
            additions.append(f"ADD {file_to_add} (new)")
    
    for file_to_replace in REPLACE_FILES:
        src_file = src / file_to_replace
        dest_file = dest / file_to_replace
        
        if not src_file.exists():
            skips.append(f"SKIP_MISSING {file_to_replace} (source not found)")
            continue
        
        if dest_file.exists():
            replacements.append(f"REPLACE {file_to_replace} (update)")
        else:
            additions.append(f"ADD {file_to_replace} (new, replace policy)")
    
    return additions, replacements, skips

def apply_changes(src: Path, dest: Path, force: bool = False) -> Tuple[bool, Dict]:
    """Apply the installation plan."""
    stats = {
        "added": 0,
        "replaced": 0,
        "skipped": 0,
        "errors": 0,
    }
    
    # Backup first
    backup_path = backup_tree(dest, BACKUP_DIR)
    print(f"\n✓ Full backup created: {backup_path}\n")
    
    # Process ADD files
    for file_to_add in ADD_FILES:
        src_file = src / file_to_add
        dest_file = dest / file_to_add
        
        if not src_file.exists():
            print(f"  ⊘ {file_to_add} — source not found")
            stats["skipped"] += 1
            continue
        
        if dest_file.exists() and not force:
            print(f"  ⊘ {file_to_add} — exists (use --force to overwrite)")
            stats["skipped"] += 1
            continue
        
        try:
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dest_file)
            
            if dest_file.exists() and src_file.exists():
                dest_hash = sha256(dest_file)
                src_hash = sha256(src_file)
                if dest_hash == src_hash:
                    action = "✓ ADDED" if not dest_file.exists() or dest_hash != sha256(src_file) else "✓ REPLACED"
                    print(f"  {action} {file_to_add}")
                    stats["added"] += 1
                else:
                    print(f"  ✗ {file_to_add} — hash mismatch after copy!")
                    stats["errors"] += 1
            else:
                print(f"  ✗ {file_to_add} — copy failed")
                stats["errors"] += 1
        except Exception as e:
            print(f"  ✗ {file_to_add} — {e}")
            stats["errors"] += 1
    
    # Process REPLACE files
    for file_to_replace in REPLACE_FILES:
        src_file = src / file_to_replace
        dest_file = dest / file_to_replace
        
        if not src_file.exists():
            print(f"  ⊘ {file_to_replace} — source not found")
            stats["skipped"] += 1
            continue
        
        try:
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dest_file)
            
            if dest_file.exists():
                dest_hash = sha256(dest_file)
                src_hash = sha256(src_file)
                if dest_hash == src_hash:
                    print(f"  ✓ REPLACED {file_to_replace}")
                    stats["replaced"] += 1
                else:
                    print(f"  ✗ {file_to_replace} — hash mismatch!")
                    stats["errors"] += 1
            else:
                print(f"  ✗ {file_to_replace} — copy failed")
                stats["errors"] += 1
        except Exception as e:
            print(f"  ✗ {file_to_replace} — {e}")
            stats["errors"] += 1
    
    return stats["errors"] == 0, stats

def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Install/update R3V4 documentation bundle",
        epilog="Default behavior: dry-run only (safe). Use --apply to execute."
    )
    parser.add_argument("--dry-run", action="store_true", 
                       help="Show plan without applying (default)")
    parser.add_argument("--apply", action="store_true", 
                       help="Execute installation with backups")
    parser.add_argument("--force", action="store_true", 
                       help="Overwrite existing ADD files (use with --apply)")
    
    args = parser.parse_args()
    
    # Default to dry-run if neither --dry-run nor --apply specified
    if not args.dry_run and not args.apply:
        args.dry_run = True
    
    print("\n" + "="*80)
    print("  R3V4 Documentation Installer (FIXED — MEDIUM-1 bug resolved)")
    print("="*80 + "\n")
    
    # Verify paths
    if not SRC_DIR.exists():
        print(f"❌ Source dir not found: {SRC_DIR}")
        sys.exit(2)
    
    if not DEST_DIR.exists():
        print(f"❌ Destination dir not found: {DEST_DIR}")
        sys.exit(2)
    
    # Generate plan
    additions, replacements, skips = dry_run_plan(SRC_DIR, DEST_DIR, force=args.force)
    
    print(f"Source: {SRC_DIR}")
    print(f"Destination: {DEST_DIR}")
    print(f"Mode: {'DRY-RUN' if args.dry_run else 'APPLY'}\n")
    
    # Show plan
    print("Plan:")
    for action in additions:
        print(f"  + {action}")
    for action in replacements:
        print(f"  ~ {action}")
    for action in skips:
        print(f"  ⊘ {action}")
    
    total = len(additions) + len(replacements) + len(skips)
    print(f"\nSummary: {len(additions)} additions, {len(replacements)} replacements, {len(skips)} skipped")
    
    if args.dry_run:
        print("\nDRY-RUN: No changes made. Use --apply to execute.")
        sys.exit(0)
    
    if args.apply:
        print("\n" + "="*80)
        print("  Applying changes...")
        print("="*80 + "\n")
        
        success, stats = apply_changes(SRC_DIR, DEST_DIR, force=args.force)
        
        print(f"\nResult: {stats['added']} added, {stats['replaced']} replaced, "
              f"{stats['skipped']} skipped, {stats['errors']} errors")
        
        if success:
            print("\n✅ Installation successful!")
            print("\nNext steps:")
            print(f"  1. Review changes: git diff {DEST_DIR}")
            print(f"  2. Commit: git add {DEST_DIR}/*.md && git commit")
            print(f"  3. Backup kept at: {BACKUP_DIR}")
            sys.exit(0)
        else:
            print("\n❌ Installation had errors!")
            sys.exit(1)

if __name__ == "__main__":
    main()
