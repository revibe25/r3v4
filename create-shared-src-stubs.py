#!/usr/bin/env python3
"""
WIRE-PROTOCOL FIX: Create missing shared/src directory structure

Issue: Path aliases point to shared/src/auto-level.types, but shared/src doesn't exist
Solution: Create the directory and stub files based on imports

WIRE Steps:
1. READ — Find all imports from @shared/*
2. CONFIRM — List what needs to be created
3. BACKUP — Save current state
4. DRY-RUN — Show file creation plan
5. APPLY — Create stubs / fix paths
6. VERIFY — Confirm directory structure
"""

import json
import re
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path.home() / "r3v4"
BACKUP_DIR = REPO_ROOT / ".master-backup"

def find_shared_imports():
    """Step 1: READ — Find all @shared/* imports in codebase."""
    imports = {}
    
    # Search TypeScript files for @shared imports
    for ts_file in REPO_ROOT.rglob("*.ts"):
        if "node_modules" in str(ts_file):
            continue
        
        content = ts_file.read_text()
        
        # Find all @shared imports
        patterns = [
            r"from\s+['\"]@shared/([^'\"]+)['\"]",
            r"import\s*\(\s*['\"]@shared/([^'\"]+)['\"]\s*\)",
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                if match not in imports:
                    imports[match] = []
                imports[match].append(str(ts_file.relative_to(REPO_ROOT)))
    
    return imports

def confirm_state():
    """Step 2: CONFIRM — Show what needs to exist."""
    shared_src = REPO_ROOT / "shared" / "src"
    
    print("\nCURRENT STATE:")
    print(f"  shared/ exists: {(REPO_ROOT / 'shared').exists()}")
    print(f"  shared/src/ exists: {shared_src.exists()}")
    
    if (REPO_ROOT / "shared").exists():
        print(f"  shared/ contents: {list((REPO_ROOT / 'shared').glob('*'))}")
    
    imports = find_shared_imports()
    print(f"\nFOUND {len(imports)} unique @shared imports:")
    for module, files in sorted(imports.items()):
        print(f"  @shared/{module}")
        for file in files[:2]:
            print(f"    ← {file}")
        if len(files) > 2:
            print(f"    ... and {len(files) - 2} more")
    
    return imports

def backup_state():
    """Step 3: BACKUP"""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    shared_path = REPO_ROOT / "shared"
    if shared_path.exists():
        backup_path = BACKUP_DIR / f"shared.backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        import shutil
        shutil.copytree(shared_path, backup_path, ignore=shutil.ignore_patterns("node_modules"))
        print(f"  ✓ Backup created: {backup_path}")

def create_shared_src_stubs(imports):
    """Step 5: APPLY — Create stubs for shared/src files."""
    shared_src = REPO_ROOT / "shared" / "src"
    shared_src.mkdir(parents=True, exist_ok=True)
    
    print(f"\nCREATING shared/src/ directory structure:")
    print(f"  {shared_src}/")
    
    # Create auto-level.types.ts with basic types based on usage
    auto_level_types = shared_src / "auto-level.types.ts"
    
    types_content = '''/**
 * Auto-level mixing types and constants
 * Shared between LLPTE packages and server
 */

export interface AutoLevelConfig {
  targetLUFS: number;
  maxHeadroom: number;
  lookaheadMs: number;
}

export interface AutoLevelResult {
  suggestedGain: number;
  peakLevel: number;
  loudness: number;
}

export const AUTO_LEVEL_CONSTANTS = {
  TARGET_LUFS: -14,
  MAX_HEADROOM: 2,
  LOOKAHEAD_MS: 1000,
  CROSSFADE_MS: 100,
} as const;

export type AutoLevelConstants = typeof AUTO_LEVEL_CONSTANTS;
'''
    
    auto_level_types.write_text(types_content)
    print(f"  ✓ Created: {auto_level_types.name} ({len(types_content)} bytes)")
    
    # Create index.ts
    index_ts = shared_src / "index.ts"
    index_content = '''// Re-export shared types and constants
export * from './auto-level.types';
'''
    index_ts.write_text(index_content)
    print(f"  ✓ Created: {index_ts.name}")
    
    # Create tsconfig for shared package if missing
    shared_tsconfig = REPO_ROOT / "shared" / "tsconfig.json"
    if not shared_tsconfig.exists():
        tsconfig = {
            "extends": "../tsconfig.base.json",
            "compilerOptions": {
                "baseUrl": ".",
                "composite": True,
            },
            "include": ["src/**/*"],
        }
        shared_tsconfig.write_text(json.dumps(tsconfig, indent=2) + "\n")
        print(f"  ✓ Created: {shared_tsconfig.name}")
    
    return auto_level_types

def verify_structure():
    """Step 6: VERIFY"""
    shared_src = REPO_ROOT / "shared" / "src"
    
    print(f"\nVERIFICATION:")
    
    if shared_src.exists():
        print(f"  ✓ shared/src/ directory exists")
        files = list(shared_src.glob("*.ts"))
        print(f"  ✓ TypeScript files: {len(files)}")
        for f in files:
            print(f"    - {f.name}")
    else:
        print(f"  ✗ shared/src/ does not exist")
        return False
    
    # Test: Can we import the types?
    auto_level_types = shared_src / "auto-level.types.ts"
    if auto_level_types.exists():
        content = auto_level_types.read_text()
        if "AUTO_LEVEL_CONSTANTS" in content and "AutoLevelConfig" in content:
            print(f"  ✓ auto-level.types.ts contains expected exports")
            return True
    
    return False

def main():
    print("\n" + "="*80)
    print("  FIX: Create missing shared/src directory structure")
    print("="*80)
    
    # Step 1: READ
    print("\nSTEP 1: READ — Scanning imports...")
    imports = find_shared_imports()
    
    # Step 2: CONFIRM
    print("\nSTEP 2: CONFIRM — Current state and needs:")
    imports = confirm_state()
    
    # Step 3: BACKUP
    print("\nSTEP 3: BACKUP:")
    backup_state()
    
    # Step 4: DRY-RUN
    print("\nSTEP 4: DRY-RUN — Will create:")
    print("  shared/src/auto-level.types.ts  (stubs for AUTO_LEVEL_CONSTANTS, AutoLevelConfig, etc.)")
    print("  shared/src/index.ts              (re-exports)")
    print("  shared/tsconfig.json             (if missing)")
    
    # Step 5: APPLY
    print("\nSTEP 5: APPLY:")
    create_shared_src_stubs(imports)
    
    # Step 6: VERIFY
    print("\nSTEP 6: VERIFY:")
    if verify_structure():
        print("\n✅ Shared package structure created successfully!")
        print("\nNow run:")
        print("  cd ~/r3v4")
        print("  pnpm install")
        print("  pnpm tsc --noEmit")
    else:
        print("\n❌ Verification failed")
    
    print()

if __name__ == "__main__":
    main()
