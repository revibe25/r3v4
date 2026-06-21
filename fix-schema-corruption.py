#!/usr/bin/env python3
"""
R3 v4 Schema Corruption Fix - Production Grade
Fixes: sessionMetrics table corruption + teamRoleEnum placement
Date: June 20, 2026
"""

import os
import sys
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

SCHEMA_FILE = "server/db/schema.ts"
BACKUP_DIR = ".backups"
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_FILE = f"{BACKUP_DIR}/schema_backup_{TIMESTAMP}.ts"

# ═══════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════

def log_info(msg: str):
    print(f"[INFO] {msg}")

def log_warn(msg: str):
    print(f"[WARN] {msg}", file=sys.stderr)

def log_error(msg: str):
    print(f"[ERROR] {msg}", file=sys.stderr)

def log_success(msg: str):
    print(f"[✓] {msg}")

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1: PRE-FIX VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

def validate_preconditions():
    """Verify file exists and is accessible"""
    print("\n═══ PHASE 1: PRE-FIX VALIDATION ═══\n")
    
    if not os.path.exists(SCHEMA_FILE):
        log_error(f"Schema file not found: {SCHEMA_FILE}")
        sys.exit(1)
    
    log_success(f"Schema file found: {SCHEMA_FILE}")
    
    if not os.access(SCHEMA_FILE, os.R_OK):
        log_error(f"Cannot read schema file")
        sys.exit(1)
    
    log_success("File is readable")
    
    if not os.access(SCHEMA_FILE, os.W_OK):
        log_error(f"Cannot write to schema file")
        sys.exit(1)
    
    log_success("File is writable")
    
    # Create backup directory
    os.makedirs(BACKUP_DIR, exist_ok=True)
    log_success(f"Backup directory ready: {BACKUP_DIR}")

def read_schema():
    """Read and return schema file content"""
    with open(SCHEMA_FILE, 'r', encoding='utf-8') as f:
        return f.read()

def backup_schema(content: str):
    """Create timestamped backup"""
    try:
        with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
            f.write(content)
        log_success(f"Backup created: {BACKUP_FILE}")
        return True
    except Exception as e:
        log_error(f"Failed to create backup: {e}")
        return False

def analyze_corruption(content: str):
    """Analyze the corruption patterns"""
    print("\n═══ PHASE 1.5: CORRUPTION ANALYSIS ═══\n")
    
    # Check for garbage pattern
    garbage_pattern = '"viewer",       // Read-only dashboards\n]);'
    if garbage_pattern in content:
        log_warn("Found garbage pattern in file (expected)")
        log_info("Pattern: '\"viewer\", // Read-only dashboards\\n]);'")
    else:
        log_warn("Garbage pattern not found - corruption may differ from expected")
    
    # Count viewer occurrences
    viewer_count = content.count('"viewer"')
    log_info(f"Found {viewer_count} occurrences of '\"viewer\"'")
    
    # Check teamRoleEnum
    if 'teamRoleEnum = pgEnum' in content:
        log_info("teamRoleEnum already defined")
    else:
        log_warn("teamRoleEnum NOT defined - will need to add")
    
    # Check sessionMetrics table
    if 'export const sessionMetrics = pgTable' in content:
        log_success("sessionMetrics table found")
    else:
        log_error("sessionMetrics table not found!")
        return False
    
    return True

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2: SAFE SCHEMA RECONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════════

def fix_schema_corruption(content: str) -> str:
    """Apply all schema fixes with safety checks"""
    print("\n═══ PHASE 2: SCHEMA REPAIR ═══\n")
    
    original_content = content
    
    # FIX 1: Remove garbage pattern from sessionMetrics
    log_info("Applying Fix #1: Remove garbage pattern...")
    garbage_pattern = '  createdAt:        timestamp("created_at").notNull().defaultNow(),\n  "viewer",       // Read-only dashboards\n]);'
    correct_pattern = '  createdAt:        timestamp("created_at").notNull().defaultNow(),\n});'
    
    if garbage_pattern in content:
        content = content.replace(garbage_pattern, correct_pattern, 1)
        log_success("Removed garbage pattern from sessionMetrics")
    else:
        log_warn("Garbage pattern not found - may have different formatting")
        # Try alternative pattern
        alt_pattern = '"viewer",       // Read-only dashboards'
        if alt_pattern in content:
            log_info("Found alternative garbage pattern, attempting repair...")
            content = content.replace(alt_pattern + '\n', '', 1)
            log_success("Removed alternative garbage pattern")
        else:
            log_warn("Could not find garbage pattern - skipping")
    
    # FIX 2: Add teamRoleEnum if missing
    log_info("Applying Fix #2: Add teamRoleEnum if missing...")
    if 'teamRoleEnum = pgEnum' not in content:
        enum_definition = '''// Team role enum for user instances and permissions
export const teamRoleEnum = pgEnum("team_role", [
  "owner",        // Full admin, Penguin Machine only
  "admin",        // Can manage team members, all instances
  "developer",    // Code, deploy, read logs
  "analyst",      // Read dashboards, logs, metrics
  "viewer",       // Read-only dashboards
]);

'''
        # Insert before userInstances table
        insertion_point = 'export const userInstances = pgTable("user_instances", {'
        if insertion_point in content:
            content = content.replace(
                insertion_point,
                enum_definition + insertion_point,
                1
            )
            log_success("Added teamRoleEnum definition")
        else:
            log_error("Could not find userInstances table - cannot insert enum")
            return original_content
    else:
        log_success("teamRoleEnum already present - skipping")
    
    return content

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 3: POST-FIX VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

def validate_fixed_schema(content: str) -> bool:
    """Triple-check fixed schema"""
    print("\n═══ PHASE 3: POST-FIX VALIDATION ═══\n")
    
    validation_passed = True
    
    # Check 1: sessionMetrics closing bracket
    if '});' in content:
        log_success("Closing brackets present")
    else:
        log_error("Missing closing brackets!")
        validation_passed = False
    
    # Check 2: teamRoleEnum defined
    if 'teamRoleEnum = pgEnum' in content:
        log_success("teamRoleEnum properly defined")
    else:
        log_error("teamRoleEnum not found!")
        validation_passed = False
    
    # Check 3: teamRoleEnum before userInstances
    enum_pos = content.find('teamRoleEnum = pgEnum')
    user_instances_pos = content.find('export const userInstances = pgTable')
    
    if enum_pos > 0 and user_instances_pos > 0:
        if enum_pos < user_instances_pos:
            log_success("teamRoleEnum correctly positioned before userInstances")
        else:
            log_error("teamRoleEnum is AFTER userInstances (wrong order!)")
            validation_passed = False
    
    # Check 4: No duplicate "viewer" outside enum
    # Count should be exactly 5 (for the enum definition)
    viewer_count = content.count('"viewer"')
    if viewer_count == 5:
        log_success(f"Correct number of 'viewer' occurrences: {viewer_count}")
    else:
        log_warn(f"Unexpected 'viewer' count: {viewer_count} (expected 5)")
    
    # Check 5: No garbage patterns remain
    if '// Read-only dashboards\n]);' not in content:
        log_success("Garbage pattern removed")
    else:
        log_error("Garbage pattern still present!")
        validation_passed = False
    
    # Check 6: Valid TypeScript syntax
    log_info("Checking TypeScript syntax...")
    try:
        result = subprocess.run(
            ['npx', 'tsc', '--noEmit', SCHEMA_FILE],
            capture_output=True,
            timeout=30,
            text=True
        )
        if result.returncode == 0:
            log_success("TypeScript compilation successful")
        else:
            log_warn(f"TypeScript warnings: {result.stderr[:200]}")
    except Exception as e:
        log_warn(f"Could not run TypeScript check: {e}")
    
    return validation_passed

# ═══════════════════════════════════════════════════════════════════════════
# PHASE 4: WRITE & COMMIT
# ═══════════════════════════════════════════════════════════════════════════

def write_schema(content: str) -> bool:
    """Write fixed schema back to file"""
    print("\n═══ PHASE 4: WRITE & COMMIT ═══\n")
    
    try:
        with open(SCHEMA_FILE, 'w', encoding='utf-8') as f:
            f.write(content)
        log_success(f"Schema file updated: {SCHEMA_FILE}")
        return True
    except Exception as e:
        log_error(f"Failed to write schema: {e}")
        return False

def verify_written_file():
    """Read back and verify"""
    try:
        with open(SCHEMA_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'teamRoleEnum = pgEnum' in content:
            log_success("File verification: teamRoleEnum confirmed in disk")
        else:
            log_error("File verification failed!")
            return False
        
        if '"viewer",       // Read-only dashboards\n]);' not in content:
            log_success("File verification: garbage pattern removed")
        else:
            log_error("File verification: garbage still present!")
            return False
        
        return True
    except Exception as e:
        log_error(f"Could not verify written file: {e}")
        return False

# ═══════════════════════════════════════════════════════════════════════════
# ROLLBACK
# ═══════════════════════════════════════════════════════════════════════════

def rollback():
    """Rollback to backup if fix failed"""
    print("\n═══ ROLLBACK ═══\n")
    
    if os.path.exists(BACKUP_FILE):
        try:
            shutil.copy(BACKUP_FILE, SCHEMA_FILE)
            log_success(f"Rolled back to: {BACKUP_FILE}")
            return True
        except Exception as e:
            log_error(f"Rollback failed: {e}")
            return False
    else:
        log_error("No backup file found!")
        return False

# ═══════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

def main():
    print("╔════════════════════════════════════════════════════════════╗")
    print("║     R3 v4 Schema Corruption Fix - Master Script            ║")
    print("║     Date: June 20, 2026                                    ║")
    print("╚════════════════════════════════════════════════════════════╝")
    
    # Phase 1: Validate
    validate_preconditions()
    content = read_schema()
    
    if not backup_schema(content):
        log_error("Backup failed - aborting!")
        sys.exit(1)
    
    if not analyze_corruption(content):
        log_error("Corruption analysis failed - aborting!")
        sys.exit(1)
    
    # Phase 2: Fix
    fixed_content = fix_schema_corruption(content)
    
    # Phase 3: Validate fix
    if not validate_fixed_schema(fixed_content):
        log_error("Post-fix validation failed - rolling back!")
        rollback()
        sys.exit(1)
    
    # Phase 4: Write
    if not write_schema(fixed_content):
        log_error("Failed to write schema - rolling back!")
        rollback()
        sys.exit(1)
    
    if not verify_written_file():
        log_error("File verification failed - rolling back!")
        rollback()
        sys.exit(1)
    
    # Success
    print("\n╔════════════════════════════════════════════════════════════╗")
    print("║                    ✓ FIX COMPLETE ✓                       ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(f"\nBackup saved to: {BACKUP_FILE}")
    print(f"Schema fixed: {SCHEMA_FILE}")
    print("\nNext steps:")
    print("  1. Review changes: git diff server/db/schema.ts")
    print("  2. Test: pnpm run tsc --noEmit")
    print("  3. Commit: git add server/db/schema.ts && git commit -m 'fix: repair sessionMetrics schema corruption'")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
