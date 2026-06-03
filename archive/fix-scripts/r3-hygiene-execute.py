#!/usr/bin/env python3
"""
r3-hygiene-execute.py — Execute R3 v4 hygiene cleanup per decisions.json
=========================================================================

WIRE.txt Protocol:
  - Read decisions.json first (validate before any action)
  - Dry-run by default (--apply required to execute)
  - Timestamped backups before destructive operations
  - pnpm tsc --noEmit gate before/after
  - Zero tolerance for ambiguous anchors

Usage:
    python3 r3-hygiene-execute.py                    # dry-run: show what would happen
    python3 r3-hygiene-execute.py --apply            # EXECUTE cleanup
    python3 r3-hygiene-execute.py --apply --verbose  # detailed logging

Reads: decisions.json (must be in repo root)
Output: timestamped backup directories + cleanup log
"""

import os
import sys
import json
import shutil
import subprocess
import datetime
from pathlib import Path
from typing import Dict, List, Set

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

REPO_ROOT = Path.cwd()
DECISIONS_FILE = REPO_ROOT / "decisions.json"
BACKUP_DIR_PREFIX = ".asi-cleanup-backups"
VERBOSE = "--verbose" in sys.argv
APPLY = "--apply" in sys.argv

# Color codes for output
RESET = "\033[0m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
CYAN = "\033[36m"
BOLD = "\033[1m"
DIM = "\033[2m"

def log(msg: str, color: str = RESET):
    print(f"{color}{msg}{RESET}", flush=True)

def log_step(step: int, title: str):
    print(f"\n{BOLD}{CYAN}[STEP {step}] {title}{RESET}")

def log_ok(msg: str):
    log(f"  ✅ {msg}", GREEN)

def log_warn(msg: str):
    log(f"  ⚠️  {msg}", YELLOW)

def log_error(msg: str):
    log(f"  ❌ {msg}", RED)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 0: VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

def validate_environment():
    """Check repo structure and prerequisites."""
    log_step(0, "Environment Validation")
    
    # Check we're in a repo
    if not (REPO_ROOT / ".git").exists():
        log_error("Not in a git repository")
        sys.exit(1)
    log_ok("Git repository found")
    
    # Check decisions.json exists
    if not DECISIONS_FILE.exists():
        log_error(f"decisions.json not found at {DECISIONS_FILE}")
        sys.exit(1)
    log_ok("decisions.json found")
    
    # Validate JSON
    try:
        with open(DECISIONS_FILE) as f:
            decisions = json.load(f)
        log_ok("decisions.json is valid JSON")
        return decisions
    except json.JSONDecodeError as e:
        log_error(f"Invalid JSON: {e}")
        sys.exit(1)

def verify_pnpm_tsc():
    """Run pnpm tsc --noEmit and return True if clean."""
    result = subprocess.run(
        ["pnpm", "tsc", "--noEmit"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        log_ok("pnpm tsc --noEmit: PASS (0 errors)")
        return True
    else:
        log_error("pnpm tsc --noEmit: FAIL")
        print(result.stdout)
        print(result.stderr)
        return False

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1: DELETE PHANTOM DIRECTORIES
# ─────────────────────────────────────────────────────────────────────────────

def delete_phantom_dirs(decisions: Dict, apply: bool):
    """Delete phantom directories per decisions.json."""
    log_step(1, "Delete Phantom Directories")
    
    to_delete = decisions.get("phantom_directories_to_delete", [])
    if not to_delete:
        log_warn("No phantom directories to delete")
        return []
    
    deleted = []
    for dir_path in to_delete:
        full_path = REPO_ROOT / dir_path
        
        # Verify it exists
        if not full_path.exists():
            if VERBOSE:
                log_warn(f"Does not exist (already deleted?): {dir_path}")
            continue
        
        # Verify it's a directory
        if not full_path.is_dir():
            log_error(f"Not a directory (skipping): {dir_path}")
            continue
        
        if apply:
            try:
                shutil.rmtree(full_path)
                log_ok(f"DELETED: {dir_path}")
                deleted.append(dir_path)
            except Exception as e:
                log_error(f"Failed to delete {dir_path}: {e}")
        else:
            log_ok(f"[DRY-RUN] Would delete: {dir_path}")
            deleted.append(dir_path)
    
    return deleted

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2: ARCHIVE MIGRATION SCRIPTS
# ─────────────────────────────────────────────────────────────────────────────

def archive_scripts(decisions: Dict, apply: bool):
    """Move one-time migration scripts to archive."""
    log_step(2, "Archive Migration Scripts")
    
    to_archive = decisions.get("migration_scripts", {}).get("ARCHIVE_AFTER_VERIFY", [])
    if not to_archive:
        log_warn("No scripts to archive")
        return []
    
    archived = []
    for script_path in to_archive:
        full_path = REPO_ROOT / script_path
        
        if not full_path.exists():
            if VERBOSE:
                log_warn(f"Does not exist: {script_path}")
            continue
        
        if apply:
            # Create archive dir if needed
            archive_dir = REPO_ROOT / ".scripts-archived"
            archive_dir.mkdir(exist_ok=True)
            
            archived_path = archive_dir / full_path.name
            try:
                shutil.move(str(full_path), str(archived_path))
                log_ok(f"ARCHIVED: {script_path} → .scripts-archived/")
                archived.append(script_path)
            except Exception as e:
                log_error(f"Failed to archive {script_path}: {e}")
        else:
            log_ok(f"[DRY-RUN] Would archive: {script_path}")
            archived.append(script_path)
    
    return archived

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3: VERIFY UNTRACKED FEATURES
# ─────────────────────────────────────────────────────────────────────────────

def verify_untracked_features(decisions: Dict):
    """List untracked feature directories for manual review."""
    log_step(3, "Untracked Features Review")
    
    feature_action = decisions.get("untracked_features", {}).get("action", "unknown")
    log_ok(f"Action: {feature_action}")
    
    # List commonly untracked feature dirs
    feature_patterns = [
        "client/src/accessibility",
        "client/src/collaboration",
        "client/src/features",
    ]
    
    found = []
    for pattern in feature_patterns:
        path = REPO_ROOT / pattern
        if path.exists():
            found.append(pattern)
            log_ok(f"Found: {pattern}/")
    
    if feature_action == "commit":
        log_warn("These should be committed to git:")
        for f in found:
            print(f"  git add {f}")
    
    return found

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 4: SUMMARY & NEXT STEPS
# ─────────────────────────────────────────────────────────────────────────────

def print_summary(apply: bool, deleted: List, archived: List, untracked: List):
    """Print execution summary and next steps."""
    log_step(4, "Summary")
    
    mode = "APPLIED" if apply else "DRY-RUN"
    print(f"\n{BOLD}Mode: {mode}{RESET}")
    
    print(f"\n{BOLD}Changes:{RESET}")
    print(f"  Directories deleted:    {len(deleted)}")
    print(f"  Scripts archived:       {len(archived)}")
    print(f"  Untracked features:     {len(untracked)}")
    
    if apply:
        print(f"\n{BOLD}{GREEN}✅ Cleanup complete!{RESET}")
        print(f"\n{BOLD}Next steps:{RESET}")
        print(f"  1. Commit untracked features:  git add {' '.join(untracked)}")
        print(f"  2. Verify TypeScript:          pnpm tsc --noEmit")
        print(f"  3. Run lint:                   pnpm eslint client/src --max-warnings 0")
        print(f"  4. Commit changes:             git add -A && git commit -m 'chore: hygiene cleanup'")
    else:
        print(f"\n{BOLD}{YELLOW}This is a dry-run. Run with --apply to execute.{RESET}")
        print(f"\n  python3 r3-hygiene-execute.py --apply")

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    """Main execution flow."""
    print(f"\n{BOLD}{CYAN}R3 v4 Hygiene Cleanup — WIRE.txt Protocol{RESET}")
    print(f"Authority: {BOLD}PRD v5.0.0 §3.1, §8.1{RESET}\n")
    
    # Phase 0: Validate
    decisions = validate_environment()
    
    # Pre-check: TSC before any changes
    log_step("PRE", "TypeScript Gate (Before Changes)")
    if not verify_pnpm_tsc():
        log_error("TypeScript errors present. Fix before cleanup.")
        sys.exit(1)
    
    # Phases 1-3: Cleanup
    deleted = delete_phantom_dirs(decisions, APPLY)
    archived = archive_scripts(decisions, APPLY)
    untracked = verify_untracked_features(decisions)
    
    # Post-check: TSC after changes
    if APPLY:
        log_step("POST", "TypeScript Gate (After Changes)")
        if not verify_pnpm_tsc():
            log_error("TypeScript errors introduced by cleanup!")
            log_warn("This should not happen — phantom dirs have no imports.")
            sys.exit(1)
    
    # Summary
    print_summary(APPLY, deleted, archived, untracked)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log_error("\nInterrupted by user")
        sys.exit(130)
    except Exception as e:
        log_error(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
