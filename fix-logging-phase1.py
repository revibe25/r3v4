#!/usr/bin/env python3
"""
LOGGING PHASE 1 FIX: Migrate unstructured console.* calls to structured logger
Expert-level implementation with dry-run, backup, verification, TSC check

WIRE Protocol:
  1. Read → Analyze each file and change
  2. Dry-run → Show what will change
  3. Backup → Save originals
  4. Apply → Make changes with verification
  5. Verify → Run TSC to confirm zero errors

Target files:
  - server/db/index.ts:43 (console.error)
  - server/routes.ts:128 (console.error in catch)
  - server/routes/mock-billing.ts:89,147 (console.error x2)
  - server/services/stripe-subscription.ts:236,243 (console.info, console.warn)
"""

import os
import re
import sys
import subprocess
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

# ════════════════════════════════════════════════════════════════
# CONFIGURATION
# ════════════════════════════════════════════════════════════════

PROJECT_ROOT = Path(os.getcwd())
LOGGER_IMPORT = 'import { logger } from "../utils/logger";'

# Define all fixes: (file_path, old_pattern, new_code, import_check)
FIXES: List[Tuple[str, str, str, str]] = [
    (
        "server/db/index.ts",
        r"console\.error\(\s*'\[db\]\s+Unexpected pool error:',\s*err\.message\s*\);",
        "logger.error('Unexpected pool error', { message: err.message });",
        "logger"
    ),
    (
        "server/routes.ts",
        r"\.catch\(console\.error\);",
        ".catch((err) => logger.error('Failed to unlink uploaded file', { error: err instanceof Error ? err.message : String(err) }));",
        "logger"
    ),
    (
        "server/routes/mock-billing.ts",
        r"console\.error\(\s*'\[mock-billing\]\s+applyMockSubscription failed:',\s*\(err as Error\)\.message\s*\);",
        "logger.error('applyMockSubscription failed', { error: (err as Error).message });",
        "logger"
    ),
    (
        "server/routes/mock-billing.ts",
        r"console\.error\(\s*'\[mock-billing\]\s+cancelMockSubscription failed:',\s*\(err as Error\)\.message\s*\);",
        "logger.error('cancelMockSubscription failed', { error: (err as Error).message });",
        "logger"
    ),
    (
        "server/services/stripe-subscription.ts",
        r"console\.info\(`\[stripe\]\s+unhandled event type:\s+\$\{event\.type\}`\);",
        "logger.info('unhandled stripe event type', { eventType: event.type });",
        "logger"
    ),
    (
        "server/services/stripe-subscription.ts",
        r"console\.warn\(\s*'\[stripe\]\s+subscription missing r3UserId metadata',\s*sub\.id\s*\);",
        "logger.warn('subscription missing r3UserId metadata', { subscriptionId: sub.id });",
        "logger"
    ),
]

# ════════════════════════════════════════════════════════════════
# UTILITIES
# ════════════════════════════════════════════════════════════════

def color(text: str, code: str) -> str:
    """ANSI color codes"""
    codes = {
        "green": "\033[92m",
        "red": "\033[91m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "cyan": "\033[96m",
        "reset": "\033[0m",
        "bold": "\033[1m",
    }
    return f"{codes.get(code, '')}{text}{codes['reset']}"

def log_header(text: str):
    print(f"\n{color('═' * 70, 'cyan')}")
    print(color(f"  {text}", 'bold'))
    print(f"{color('═' * 70, 'cyan')}\n")

def log_success(text: str):
    print(f"{color('✓', 'green')} {text}")

def log_error(text: str):
    print(f"{color('✗', 'red')} {text}")

def log_warn(text: str):
    print(f"{color('⚠', 'yellow')} {text}")

def log_info(text: str):
    print(f"{color('ℹ', 'blue')} {text}")

# ════════════════════════════════════════════════════════════════
# PHASE 1: READ & ANALYZE
# ════════════════════════════════════════════════════════════════

def read_file(filepath: Path) -> str:
    """Read file with error handling"""
    try:
        return filepath.read_text(encoding="utf-8")
    except FileNotFoundError:
        log_error(f"File not found: {filepath}")
        return None
    except Exception as e:
        log_error(f"Error reading {filepath}: {e}")
        return None

def find_matches(content: str, pattern: str) -> List[Tuple[int, str]]:
    """Find pattern matches with line numbers"""
    matches = []
    for i, line in enumerate(content.split('\n'), 1):
        if re.search(pattern, line):
            matches.append((i, line.strip()))
    return matches

# ════════════════════════════════════════════════════════════════
# PHASE 2: DRY-RUN
# ════════════════════════════════════════════════════════════════

def dry_run():
    """Analyze all changes without modifying files"""
    log_header("PHASE 2: DRY-RUN ANALYSIS")
    
    changes_summary = {}
    
    for file_path, pattern, new_code, import_name in FIXES:
        full_path = PROJECT_ROOT / file_path
        content = read_file(full_path)
        
        if content is None:
            log_error(f"Cannot read {file_path}")
            continue
        
        # Find matches
        matches = find_matches(content, pattern)
        
        if not matches:
            log_warn(f"{file_path}: Pattern not found (may already be fixed)")
            continue
        
        # Check import
        has_import = import_name in content
        
        print(f"\n{color(file_path, 'cyan')}")
        print(f"  Matches: {len(matches)}")
        for line_num, line_content in matches:
            print(f"    Line {line_num}: {line_content[:70]}...")
        
        if not has_import:
            log_warn(f"  Import check: '{import_name}' not found in imports")
        else:
            log_success(f"  Import check: '{import_name}' already imported")
        
        changes_summary[file_path] = {
            "matches": len(matches),
            "has_import": has_import,
            "needs_import": not has_import,
        }
    
    print(f"\n{color('Summary:', 'bold')}")
    print(json.dumps(changes_summary, indent=2))
    
    return changes_summary

# ════════════════════════════════════════════════════════════════
# PHASE 3: BACKUP
# ════════════════════════════════════════════════════════════════

def create_backup(filepath: Path) -> Path:
    """Create timestamped backup of file"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = filepath.with_suffix(f".{timestamp}.bak")
    try:
        backup_path.write_text(filepath.read_text(encoding="utf-8"), encoding="utf-8")
        return backup_path
    except Exception as e:
        log_error(f"Failed to backup {filepath}: {e}")
        return None

# ════════════════════════════════════════════════════════════════
# PHASE 4: APPLY FIXES
# ════════════════════════════════════════════════════════════════

def ensure_import(content: str, import_line: str, file_path: str) -> str:
    """Add import if not present"""
    if import_line.split()[2] in content:  # extract import source name
        return content
    
    # Find the best place to insert (after existing imports)
    lines = content.split('\n')
    insert_pos = 0
    
    # Find last import line
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') or line.strip().startswith('export '):
            insert_pos = i + 1
    
    lines.insert(insert_pos, import_line)
    return '\n'.join(lines)

def apply_fixes():
    """Apply all fixes to files"""
    log_header("PHASE 4: APPLY FIXES")
    
    applied_count = 0
    failed_count = 0
    
    for file_path, pattern, new_code, import_name in FIXES:
        full_path = PROJECT_ROOT / file_path
        
        log_info(f"Processing {file_path}...")
        
        # Read
        content = read_file(full_path)
        if content is None:
            failed_count += 1
            continue
        
        # Backup
        backup_path = create_backup(full_path)
        if backup_path:
            log_success(f"  Backup created: {backup_path.name}")
        else:
            log_error(f"  Backup failed, skipping this file")
            failed_count += 1
            continue
        
        # Ensure import
        if import_name not in content:
            content = ensure_import(content, LOGGER_IMPORT, file_path)
            log_info(f"  Added import: {import_name}")
        
        # Apply regex replacement
        try:
            new_content = re.sub(pattern, new_code, content)
            
            if new_content == content:
                log_warn(f"  No changes applied (pattern may have changed)")
                failed_count += 1
                continue
            
            # Write
            full_path.write_text(new_content, encoding="utf-8")
            log_success(f"  Changes applied successfully")
            applied_count += 1
            
        except Exception as e:
            log_error(f"  Failed to apply fix: {e}")
            failed_count += 1
    
    print(f"\n{color('Applied:', 'green')} {applied_count}/{len(FIXES)}")
    print(f"{color('Failed:', 'red')} {failed_count}/{len(FIXES)}")
    
    return applied_count, failed_count

# ════════════════════════════════════════════════════════════════
# PHASE 5: VERIFY
# ════════════════════════════════════════════════════════════════

def verify_tsc():
    """Run TypeScript compiler to verify no errors"""
    log_header("PHASE 5: VERIFICATION (TSC)")
    
    try:
        log_info("Running: pnpm tsc -p client/tsconfig.json --noEmit")
        result = subprocess.run(
            ["pnpm", "tsc", "-p", "client/tsconfig.json", "--noEmit"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            log_success("Client TSC: Zero errors ✓")
        else:
            log_error(f"Client TSC errors:\n{result.stderr}")
        
        log_info("Running: pnpm tsc -p server/tsconfig.json --noEmit")
        result = subprocess.run(
            ["pnpm", "tsc", "-p", "server/tsconfig.json", "--noEmit"],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            log_success("Server TSC: Zero errors ✓")
        else:
            log_error(f"Server TSC errors:\n{result.stderr}")
        
    except subprocess.TimeoutExpired:
        log_error("TSC check timed out")
    except FileNotFoundError:
        log_warn("pnpm or tsc not found; skipping TypeScript check")
    except Exception as e:
        log_error(f"TSC check failed: {e}")

def verify_logging_calls():
    """Verify all unstructured logging is gone"""
    log_header("VERIFICATION: Remaining Console Calls")
    
    remaining = []
    
    for file_path, _, _, _ in FIXES:
        full_path = PROJECT_ROOT / file_path
        content = read_file(full_path)
        
        if content is None:
            continue
        
        # Check for remaining console.* calls (excluding comments and logger calls)
        for i, line in enumerate(content.split('\n'), 1):
            if 'console.' in line and 'logger' not in line and '//' not in line:
                remaining.append((file_path, i, line.strip()))
    
    if remaining:
        log_warn(f"Found {len(remaining)} potential console calls:")
        for file, line_num, code in remaining:
            print(f"  {file}:{line_num} → {code[:60]}...")
    else:
        log_success("No unstructured console calls found ✓")

# ════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════

def main():
    log_header("LOGGING PHASE 1 FIX - EXPERT SCRIPT")
    
    print(f"Working directory: {PROJECT_ROOT}")
    print(f"Target files: {len(FIXES)}")
    print(f"Logger import: {LOGGER_IMPORT.split()[2].split(';')[0]}")
    
    # Check if running from correct directory
    if not (PROJECT_ROOT / "server").exists():
        log_error("server/ directory not found. Are you in project root?")
        sys.exit(1)
    
    # Phase 1: Analyze
    log_header("PHASE 1: READ & ANALYZE")
    print(f"Checking {len(FIXES)} fixes...\n")
    for file_path, _, _, _ in FIXES:
        full_path = PROJECT_ROOT / file_path
        if full_path.exists():
            log_success(f"Found: {file_path}")
        else:
            log_error(f"Missing: {file_path}")
    
    # Phase 2: Dry-run
    changes = dry_run()
    
    # Ask for confirmation
    print(f"\n{color('Ready to apply fixes?', 'bold')}")
    response = input(f"{color('(yes/no):', 'cyan')} ").strip().lower()
    
    if response != "yes":
        log_warn("Aborted by user")
        sys.exit(0)
    
    # Phase 3+4: Backup & Apply
    log_header("PHASE 3-4: BACKUP & APPLY")
    applied, failed = apply_fixes()
    
    # Phase 5: Verify
    verify_logging_calls()
    verify_tsc()
    
    # Summary
    log_header("SUMMARY")
    print(f"{color('✓ Fixes applied:', 'green')} {applied}")
    print(f"{color('✗ Failed:', 'red')} {failed}")
    
    if failed == 0:
        log_success("All fixes applied successfully!")
        print("\nNext steps:")
        print("  1. Review the changes: git diff server/")
        print("  2. Run tests: pnpm test")
        print("  3. Commit: git commit -am 'refactor: migrate to structured logging'")
    else:
        log_warn("Some fixes failed. Check backups and logs above.")

if __name__ == "__main__":
    main()
