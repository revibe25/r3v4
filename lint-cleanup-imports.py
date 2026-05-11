#!/usr/bin/env python3
"""
lint-cleanup-imports.py — Remove unused imports automatically
=============================================================

WIRE.txt Protocol:
  - Reads ESLint output to find unused imports
  - Creates timestamped backup before each file edit
  - Removes ONLY unused import lines
  - Runs pnpm tsc --noEmit after each batch to verify
  - Dry-run by default

Usage:
    python3 lint-cleanup-imports.py                 # dry-run
    python3 lint-cleanup-imports.py --apply         # execute
    python3 lint-cleanup-imports.py --apply --file client/src/components/knob.tsx  # single file
"""

import os
import sys
import re
import subprocess
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Tuple

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

REPO_ROOT = Path.cwd()
APPLY = "--apply" in sys.argv
SINGLE_FILE = None
VERBOSE = "--verbose" in sys.argv

# Check for --file argument
for i, arg in enumerate(sys.argv):
    if arg == "--file" and i + 1 < len(sys.argv):
        SINGLE_FILE = sys.argv[i + 1]

# Color codes
RESET = "\033[0m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
CYAN = "\033[36m"
BOLD = "\033[1m"

def log(msg: str, color: str = RESET):
    print(f"{color}{msg}{RESET}", flush=True)

def log_step(step: str, title: str):
    print(f"\n{BOLD}{CYAN}[{step}] {title}{RESET}")

def log_ok(msg: str):
    log(f"  ✅ {msg}", GREEN)

def log_warn(msg: str):
    log(f"  ⚠️  {msg}", YELLOW)

def log_error(msg: str):
    log(f"  ❌ {msg}", RED)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1: COLLECT UNUSED IMPORTS FROM ESLINT
# ─────────────────────────────────────────────────────────────────────────────

def get_unused_imports() -> Dict[str, List[Tuple[int, str]]]:
    """
    Run ESLint and parse output to find unused imports.
    
    Returns:
        Dict[filepath, List[(line_number, import_name)]]
    """
    log_step("1", "Collecting Unused Imports from ESLint")
    
    cmd = ["pnpm", "eslint", "client/src", "--format", "compact"]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT)
    
    # Parse ESLint compact format:
    # /path/to/file.tsx: line 5, col 10, Error - 'Something' is defined but never used. (no-unused-vars)
    
    unused_imports: Dict[str, List[Tuple[int, str]]] = {}
    
    for line in result.stdout.split('\n'):
        if 'is defined but never used' not in line:
            continue
        if 'no-unused-vars' not in line and '@typescript-eslint/no-unused-vars' not in line:
            continue
            
        # Extract file path, line number, and import name
        match = re.match(r'(.+?):\s+line\s+(\d+),.+?\'(.+?)\'\s+is defined but never used', line)
        if not match:
            continue
            
        filepath, line_num, import_name = match.groups()
        filepath = filepath.strip()
        line_num = int(line_num)
        
        # Only process import statements (line contains 'import')
        # We'll verify this when reading the file
        
        if filepath not in unused_imports:
            unused_imports[filepath] = []
        unused_imports[filepath].append((line_num, import_name))
    
    log_ok(f"Found {len(unused_imports)} files with unused imports")
    
    total_unused = sum(len(items) for items in unused_imports.values())
    log_ok(f"Total unused imports: {total_unused}")
    
    return unused_imports

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2: REMOVE UNUSED IMPORTS
# ─────────────────────────────────────────────────────────────────────────────

def backup_file(filepath: Path) -> Path:
    """Create timestamped backup of file."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = filepath.parent / f"{filepath.name}.bak_{timestamp}"
    shutil.copy2(filepath, backup_path)
    return backup_path

def is_import_line(line: str, import_name: str) -> bool:
    """Check if line is an import statement containing import_name."""
    line = line.strip()
    if not line.startswith('import '):
        return False
    
    # Match various import patterns:
    # import X from '...'
    # import { X } from '...'
    # import { X, Y } from '...'
    # import type { X } from '...'
    
    # Simple check: does the line contain the import name?
    # More robust: parse the import statement properly
    
    # Pattern: import anything containing import_name
    import_pattern = rf'\bimport\s+(?:type\s+)?.*\b{re.escape(import_name)}\b.*\bfrom\b'
    return bool(re.search(import_pattern, line))

def remove_unused_imports(filepath: str, unused: List[Tuple[int, str]], apply: bool) -> bool:
    """
    Remove unused imports from a file.
    
    Returns True if file was modified.
    """
    file_path = Path(filepath)
    
    if not file_path.exists():
        log_warn(f"File not found: {filepath}")
        return False
    
    # Read file
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Identify lines to remove
    lines_to_remove = set()
    
    for line_num, import_name in unused:
        # ESLint line numbers are 1-indexed
        line_idx = line_num - 1
        
        if line_idx >= len(lines):
            continue
        
        line = lines[line_idx]
        
        # Verify this is actually an import line for this name
        if is_import_line(line, import_name):
            lines_to_remove.add(line_idx)
            if VERBOSE:
                log_warn(f"  Line {line_num}: {line.strip()}")
    
    if not lines_to_remove:
        if VERBOSE:
            log_warn(f"No import lines matched for {filepath}")
        return False
    
    # Show what we'll remove
    rel_path = file_path.relative_to(REPO_ROOT)
    log_ok(f"File: {rel_path}")
    log_ok(f"  Will remove {len(lines_to_remove)} unused import lines")
    
    if not apply:
        return False
    
    # Backup file
    backup_path = backup_file(file_path)
    log_ok(f"  Backup: {backup_path.name}")
    
    # Remove lines
    new_lines = [line for idx, line in enumerate(lines) if idx not in lines_to_remove]
    
    # Write updated file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    log_ok(f"  ✅ Removed {len(lines_to_remove)} lines")
    
    return True

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3: VERIFICATION
# ─────────────────────────────────────────────────────────────────────────────

def verify_typescript() -> bool:
    """Run pnpm tsc --noEmit to verify no TypeScript errors."""
    log_step("VERIFY", "TypeScript Compilation Check")
    
    result = subprocess.run(
        ["pnpm", "tsc", "--noEmit"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        log_ok("TypeScript: PASS (0 errors)")
        return True
    else:
        log_error("TypeScript: FAIL")
        print(result.stdout)
        print(result.stderr)
        return False

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print(f"\n{BOLD}{CYAN}Lint Cleanup: Unused Imports{RESET}")
    print(f"Mode: {'APPLY' if APPLY else 'DRY-RUN'}\n")
    
    # Verify we're in a git repo
    if not (REPO_ROOT / ".git").exists():
        log_error("Not in a git repository")
        sys.exit(1)
    
    # Pre-check: TypeScript must pass before we start
    if not verify_typescript():
        log_error("TypeScript errors present. Fix these first.")
        sys.exit(1)
    
    # Collect unused imports
    if SINGLE_FILE:
        log_ok(f"Single file mode: {SINGLE_FILE}")
        # Run ESLint on single file and parse
        unused_imports = get_unused_imports()
        unused_imports = {k: v for k, v in unused_imports.items() if SINGLE_FILE in k}
    else:
        unused_imports = get_unused_imports()
    
    if not unused_imports:
        log_ok("No unused imports found!")
        return
    
    # Process each file
    log_step("2", "Removing Unused Imports")
    
    modified_count = 0
    for filepath, unused in sorted(unused_imports.items()):
        if remove_unused_imports(filepath, unused, APPLY):
            modified_count += 1
    
    if not APPLY:
        print(f"\n{YELLOW}DRY-RUN: Would modify {modified_count} files{RESET}")
        print(f"\n{YELLOW}Run with --apply to execute{RESET}")
        return
    
    # Post-check: Verify TypeScript still passes
    if modified_count > 0:
        if not verify_typescript():
            log_error("TypeScript errors after cleanup!")
            log_warn("Check git diff and restore from backups if needed")
            sys.exit(1)
    
    # Summary
    log_step("DONE", "Summary")
    print(f"\n{GREEN}✅ Modified {modified_count} files{RESET}")
    print(f"{GREEN}✅ TypeScript: PASS{RESET}")
    print(f"\n{BOLD}Next steps:{RESET}")
    print(f"  1. Run: pnpm eslint client/src --max-warnings 0")
    print(f"  2. Verify: git diff (review changes)")
    print(f"  3. Commit: git add -A && git commit -m 'chore: remove unused imports'")

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
