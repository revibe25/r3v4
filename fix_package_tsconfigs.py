#!/usr/bin/env python3
"""
WIRE.txt Mastery: Package tsconfig.json Refactor
Fixes composite: true, extends, references, and paths for monorepo orchestration.
RULE: Only root has references. Packages extend root and set composite: true.
"""
import json
import sys
import shutil
from datetime import datetime
from pathlib import Path

DRY_RUN = "--check" in sys.argv
APPLY = "--apply" in sys.argv

FIXES = {
    "packages/llpte-core/tsconfig.json": {
        "description": "Remove self-references, fix extends",
        "fixes": {
            "extends": "../../tsconfig.json",
            "references": None,  # Remove entirely
            "compilerOptions.composite": True,
            "compilerOptions.declaration": True,  # Composite needs declarations
            "include": ["src/**/*"],
            "exclude": ["dist", "node_modules", "**/*.test.ts"],
        }
    },
    "server/tsconfig.json": {
        "description": "Add composite: true, fix rootDir/extends, remove bad includes",
        "fixes": {
            "extends": "../tsconfig.json",
            "compilerOptions.composite": True,
            "compilerOptions.rootDir": "./",
            "compilerOptions.declaration": True,
            "include": ["**/*.ts"],
            "exclude": ["dist", "node_modules", "**/*.test.ts", "vite-dev.ts", "scripts/seed"],
        }
    },
    "shared/tsconfig.json": {
        "description": "Fix rootDir, include patterns, add declaration",
        "fixes": {
            "extends": "../tsconfig.json",
            "compilerOptions.composite": True,
            "compilerOptions.rootDir": "./",
            "compilerOptions.declaration": True,
            "compilerOptions.noEmit": False,
            "include": ["src/**/*"],
            "exclude": ["dist", "node_modules"],
        }
    }
}

def apply_fixes(filepath: str, fixes: dict) -> dict:
    """Apply structured fixes to a tsconfig."""
    with open(filepath) as f:
        config = json.load(f)
    
    for key, value in fixes.items():
        if value is None:
            # Remove field
            if key in config:
                del config[key]
            continue
        
        # Handle nested keys like "compilerOptions.composite"
        if "." in key:
            parent_key, child_key = key.rsplit(".", 1)
            if parent_key not in config:
                config[parent_key] = {}
            config[parent_key][child_key] = value
        else:
            config[key] = value
    
    return config

def main():
    print("🔧 Package tsconfig.json Refactor (Mastery Level)\n")
    
    all_changes = []
    
    for filepath, spec in FIXES.items():
        print(f"📄 {filepath}")
        print(f"   {spec['description']}")
        
        if not Path(filepath).exists():
            print(f"   ✗ File not found\n")
            continue
        
        # Load original
        with open(filepath) as f:
            original = json.load(f)
        
        # Apply fixes
        fixed = apply_fixes(filepath, spec['fixes'])
        
        # Track changes
        changes = []
        for key, value in spec['fixes'].items():
            if value is None:
                changes.append(f"  ✓ Removing: {key}")
            else:
                changes.append(f"  ✓ Setting: {key} = {value}")
        
        all_changes.append((filepath, original, fixed, changes))
        
        for change in changes:
            print(change)
        print()
    
    if DRY_RUN:
        print("\n🧪 DRY-RUN: Would apply above fixes")
        for filepath, original, fixed, changes in all_changes:
            print(f"\n{filepath}:")
            print(json.dumps(fixed, indent=2))
        print("\n✓ Dry-run complete. Run with --apply to apply changes.")
        return
    
    if not APPLY:
        print("⚠️  Usage:")
        print("  python3 fix_package_tsconfigs.py --check        (dry-run)")
        print("  python3 fix_package_tsconfigs.py --apply        (apply changes)")
        sys.exit(1)
    
    # Apply changes
    print("💾 Creating backups and applying fixes...\n")
    
    for filepath, original, fixed, changes in all_changes:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{filepath}.backup_{timestamp}"
        shutil.copy2(filepath, backup_path)
        print(f"✓ Backup: {backup_path}")
        
        with open(filepath, 'w') as f:
            json.dump(fixed, f, indent=2)
            f.write('\n')
        print(f"✓ Updated: {filepath}\n")
    
    print("✅ All package tsconfigs updated!")
    print("\n🔬 Verifying with pnpm tsc --noEmit...")
    
    import subprocess
    result = subprocess.run(
        ["pnpm", "tsc", "--noEmit"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✅ TYPECHECKING PASSED!")
    else:
        if result.stderr:
            print("⚠️  Errors found:")
            # Show first 10 errors
            errors = result.stderr.split('\n')[:15]
            print('\n'.join(errors))

if __name__ == "__main__":
    main()
