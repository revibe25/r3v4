#!/usr/bin/env python3
"""
FIXED VERSION: Repair TypeScript project references in pnpm monorepo.
Adds "composite": true to LLPTE packages and cleans stale artifacts.

BUGS FIXED:
- BUG-PY-1: Type hint mismatch → Optional[dict]
- BUG-PY-2: JSON parse errors → try/except
- BUG-PY-3: Missing compilerOptions → check/create
- BUG-PY-4: Redundant loop → removed
- BUG-PY-5: File deletion errors → caught
- BUG-PY-6: Incomplete tsbuildinfo check → check both locations
- BUG-PY-7: Confusing error message → clarified
- ISSUE-PY-8: No directory validation → added monorepo check
- ISSUE-PY-10: write_tsconfig errors → caught
- ISSUE-PY-11: subprocess errors → FileNotFoundError handled
- ISSUE-PY-12: Unused imports → removed
- ISSUE-PY-13: Return type inconsistency → fixed

Usage:
  python3 composite_fix.py --check      # Dry-run, show what would change
  python3 composite_fix.py --apply      # Apply fixes
  python3 composite_fix.py --apply --verify  # Apply then run tsc check
"""

import json
import os
import sys
import subprocess
from typing import Tuple, Optional

DRY_RUN = "--check" in sys.argv
APPLY = "--apply" in sys.argv
VERIFY = "--verify" in sys.argv

# LLPTE packages requiring "composite": true
PACKAGES = [
    "packages/llpte-signal",
    "packages/llpte-core",
    "packages/llpte-ai",
    "packages/llpte-adapters",
    "packages/llpte-execution",
    "packages/llpte-transition-graph",
]


def validate_monorepo_root() -> bool:
    """Check if running in correct directory."""
    if not os.path.isfile("pnpm-workspace.yaml"):
        print("ERROR: Not in R3 v4 monorepo root (missing pnpm-workspace.yaml)")
        print("  Expected: ~/Stable/")
        print("  Got: $(pwd)")
        return False
    return True


def read_tsconfig(path: str) -> Tuple[Optional[dict], bool]:
    """Read tsconfig.json. Returns (config, had_composite)."""
    if not os.path.isfile(path):
        return None, False
    
    try:
        with open(path, 'r') as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"  ✗ ERROR: Invalid JSON in {path}: {e}")
        return None, False
    except (IOError, OSError) as e:
        print(f"  ✗ ERROR: Failed to read {path}: {e}")
        return None, False
    
    has_composite = config.get('compilerOptions', {}).get('composite', False)
    return config, has_composite


def write_tsconfig(path: str, config: dict) -> bool:
    """Write tsconfig.json with proper formatting. Returns True on success."""
    try:
        with open(path, 'w') as f:
            json.dump(config, f, indent=2)
            f.write('\n')  # Ensure final newline
        return True
    except (IOError, OSError) as e:
        print(f"  ✗ ERROR: Failed to write {path}: {e}")
        return False


def clean_dist_files(pkg_dir: str) -> int:
    """Remove stale .d.ts files. Returns count deleted."""
    dist_dir = os.path.join(pkg_dir, 'dist')
    count = 0
    
    if not os.path.isdir(dist_dir):
        return 0
    
    for root, dirs, files in os.walk(dist_dir):
        for file in files:
            if file.endswith('.d.ts') or file.endswith('.d.ts.map'):
                filepath = os.path.join(root, file)
                if not DRY_RUN:
                    try:
                        os.remove(filepath)
                    except OSError as e:
                        print(f"  ⚠ Failed to delete {filepath}: {e}")
                        continue
                count += 1
    
    return count


def clean_tsbuildinfo(pkg_dir: str) -> int:
    """Remove .tsbuildinfo files. Returns count deleted."""
    count = 0
    for path in [os.path.join(pkg_dir, '.tsbuildinfo'),
                 os.path.join(pkg_dir, 'dist', '.tsbuildinfo')]:
        if os.path.isfile(path):
            if not DRY_RUN:
                try:
                    os.remove(path)
                except OSError as e:
                    print(f"  ⚠ Failed to delete {path}: {e}")
                    continue
            count += 1
    return count


def validate_json_file(path: str) -> bool:
    """Verify JSON file is valid after edits."""
    try:
        with open(path, 'r') as f:
            json.load(f)
        return True
    except (json.JSONDecodeError, IOError) as e:
        print(f"  ✗ ERROR: Invalid JSON in {path} after edit: {e}")
        return False


def main():
    # Validate directory
    if not validate_monorepo_root():
        sys.exit(1)
    
    # Check for conflicting flags
    if DRY_RUN and APPLY:
        print("ERROR: Cannot use --check and --apply together")
        sys.exit(1)
    
    if not DRY_RUN and not APPLY:
        print("ERROR: Use --check or --apply")
        print("  python3 composite_fix.py --check")
        print("  python3 composite_fix.py --apply")
        sys.exit(1)
    
    print("=" * 60)
    print("TypeScript Project References Fixer")
    print("=" * 60)
    print(f"Mode: {'DRY-RUN' if DRY_RUN else 'APPLY'}")
    print()
    
    # Phase 1: Check LLPTE packages
    print("Phase 1: Checking LLPTE packages for 'composite' flag")
    print("-" * 60)
    
    fixes_needed = []
    for pkg in PACKAGES:
        tsconfig_path = os.path.join(pkg, 'tsconfig.json')
        config, has_composite = read_tsconfig(tsconfig_path)
        
        if config is None:
            print(f"  ⚠ Skipped: {tsconfig_path} (file missing or invalid JSON)")
            continue
        
        if has_composite:
            print(f"  ✓ {pkg}: composite=true (no change needed)")
        else:
            print(f"  ✗ {pkg}: composite=false (needs fix)")
            fixes_needed.append((pkg, config, tsconfig_path))
    
    print()
    
    # Phase 2: Apply composite fixes
    if fixes_needed:
        print("Phase 2: Adding 'composite': true")
        print("-" * 60)
        
        for pkg, config, tsconfig_path in fixes_needed:
            # Ensure compilerOptions exists
            if 'compilerOptions' not in config:
                config['compilerOptions'] = {}
            
            config['compilerOptions']['composite'] = True
            
            if DRY_RUN:
                print(f"  Would patch: {tsconfig_path}")
                print(f"    Added: 'composite': true")
            else:
                if write_tsconfig(tsconfig_path, config):
                    # Validate after write
                    if validate_json_file(tsconfig_path):
                        print(f"  ✓ Patched: {pkg}")
                    else:
                        print(f"  ✗ FAILED: {pkg} (JSON validation failed)")
                        sys.exit(1)
                else:
                    sys.exit(1)
        
        print()
    else:
        print("Phase 2: No composite fixes needed")
        print()
    
    # Phase 3: Clean stale artifacts
    print("Phase 3: Cleaning stale .d.ts and .tsbuildinfo")
    print("-" * 60)
    
    total_d_ts_deleted = 0
    total_tsbuildinfo_deleted = 0
    
    for pkg in PACKAGES:
        d_ts_count = clean_dist_files(pkg)
        tsbuildinfo_count = clean_tsbuildinfo(pkg)
        
        if d_ts_count > 0 or tsbuildinfo_count > 0:
            if DRY_RUN:
                items = []
                if d_ts_count > 0:
                    items.append(f"{d_ts_count} .d.ts files")
                if tsbuildinfo_count > 0:
                    items.append(f"{tsbuildinfo_count} .tsbuildinfo")
                msg = f"  Would clean {pkg}: " + ", ".join(items)
            else:
                items = []
                if d_ts_count > 0:
                    items.append(f"{d_ts_count} .d.ts files")
                    total_d_ts_deleted += d_ts_count
                if tsbuildinfo_count > 0:
                    items.append(f"{tsbuildinfo_count} .tsbuildinfo")
                    total_tsbuildinfo_deleted += tsbuildinfo_count
                msg = f"  ✓ Cleaned {pkg}: " + ", ".join(items)
            
            print(msg)
    
    # Clean root-level tsbuildinfo
    if os.path.isfile('.tsbuildinfo'):
        if DRY_RUN:
            print(f"  Would delete: .tsbuildinfo (root)")
        else:
            try:
                os.remove('.tsbuildinfo')
                print(f"  ✓ Deleted: .tsbuildinfo (root)")
                total_tsbuildinfo_deleted += 1
            except OSError as e:
                print(f"  ⚠ Failed to delete .tsbuildinfo: {e}")
    
    print()
    
    # Summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    
    if DRY_RUN:
        print(f"Packages needing 'composite': {len(fixes_needed)}")
        print(f"Estimated .d.ts files to delete: (see above)")
        print(f"Estimated .tsbuildinfo files to delete: (see above)")
        print()
        print("To apply fixes, run:")
        print("  python3 composite_fix.py --apply")
    else:
        print(f"✓ Composite flags added: {len(fixes_needed)}")
        print(f"✓ .d.ts files deleted: {total_d_ts_deleted}")
        print(f"✓ .tsbuildinfo files deleted: {total_tsbuildinfo_deleted}")
        print()
        print("Next steps:")
        print("  1. Verify: pnpm tsc --noEmit")
        print("  2. Rebuild: pnpm build")
        print("  3. Commit: git add packages/*/tsconfig.json")
    
    print()
    
    # Optionally run tsc --noEmit verification
    if VERIFY and not DRY_RUN:
        print("=" * 60)
        print("Running: pnpm tsc --noEmit")
        print("=" * 60)
        try:
            result = subprocess.run(['pnpm', 'tsc', '--noEmit'], cwd='.')
            if result.returncode != 0:
                print("\n✗ TypeScript check failed")
                sys.exit(result.returncode)
            else:
                print("\n✓ TypeScript check passed")
        except FileNotFoundError:
            print("\nERROR: pnpm not found")
            print("  Install: npm install -g pnpm")
            print("  Or verify pnpm is in PATH")
            sys.exit(1)


if __name__ == '__main__':
    main()
