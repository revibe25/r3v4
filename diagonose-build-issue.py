#!/usr/bin/env python3
"""
Diagnostic: Verify path alias changes and identify root cause of TS2307 errors
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path.home() / "r3v4"

def check_tsconfig_content(pkg_name):
    """Read back the tsconfig and verify changes."""
    pkg_path = REPO_ROOT / f"packages/{pkg_name}"
    tsconfig_path = pkg_path / "tsconfig.json"
    
    if not tsconfig_path.exists():
        print(f"❌ {pkg_name}: tsconfig.json doesn't exist")
        return False
    
    try:
        with open(tsconfig_path) as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ {pkg_name}: Invalid JSON — {e}")
        return False
    
    compiler_opts = config.get("compilerOptions", {})
    paths = compiler_opts.get("paths", {})
    base_url = compiler_opts.get("baseUrl", ".")
    
    print(f"\n[{pkg_name}]")
    print(f"  baseUrl: {base_url}")
    print(f"  paths: {json.dumps(paths, indent=4)}")
    
    has_shared = "@shared/*" in paths
    has_llpte = "@llpte/*" in paths
    
    if not has_shared:
        print(f"  ❌ Missing @shared/* alias")
        return False
    
    if not has_llpte:
        print(f"  ⚠️  Missing @llpte/* alias")
    
    # Check if paths resolve correctly
    print(f"\n  Path resolution check:")
    for alias, resolution in paths.items():
        print(f"    {alias} → {resolution}")
    
    return True

def check_shared_src_exists():
    """Verify that shared/src directory exists with auto-level.types.ts"""
    shared_src = REPO_ROOT / "shared/src"
    auto_level_types = shared_src / "auto-level.types.ts"
    
    print(f"\n[Dependency Check]")
    print(f"  shared/src exists: {shared_src.exists()}")
    
    if shared_src.exists():
        print(f"  Files in shared/src: {list(shared_src.glob('*.ts'))[:5]}")
    
    print(f"  auto-level.types.ts exists: {auto_level_types.exists()}")
    
    if not auto_level_types.exists():
        print(f"  ❌ CRITICAL: auto-level.types.ts is missing!")
        return False
    
    return True

def check_llpte_signal_imports():
    """Check what llpte-signal is actually importing."""
    files_to_check = [
        REPO_ROOT / "packages/llpte-signal/src/analyzers/TrackAnalyzer.ts",
        REPO_ROOT / "packages/llpte-signal/src/types/signal.types.ts",
    ]
    
    print(f"\n[Import Analysis]")
    
    for file_path in files_to_check:
        if not file_path.exists():
            print(f"  ⚠️  {file_path.relative_to(REPO_ROOT)} — not found")
            continue
        
        content = file_path.read_text()
        lines = content.splitlines()
        
        print(f"  {file_path.name}:")
        for i, line in enumerate(lines[:30], 1):
            if "@shared" in line:
                print(f"    Line {i}: {line}")

def main():
    print("\n" + "="*80)
    print("  BUILD DIAGNOSTIC — Path Alias Verification")
    print("="*80 + "\n")
    
    # Step 1: Check tsconfigs
    print("STEP 1: Verify tsconfig.json modifications")
    packages = ["llpte-signal", "llpte-core", "llpte-ai", "llpte-execution", 
                "llpte-transition-graph", "llpte-adapters"]
    
    all_good = True
    for pkg in packages:
        if not check_tsconfig_content(pkg):
            all_good = False
    
    # Step 2: Check shared/src
    print("\n" + "="*80)
    print("STEP 2: Verify dependency files exist")
    print("="*80)
    
    if not check_shared_src_exists():
        all_good = False
    
    # Step 3: Check imports
    print("\n" + "="*80)
    print("STEP 3: Analyze imports in llpte-signal")
    print("="*80)
    
    check_llpte_signal_imports()
    
    # Final report
    print("\n" + "="*80)
    print("DIAGNOSTIC SUMMARY")
    print("="*80)
    
    if all_good:
        print("\n✅ Path aliases look correct, dependencies exist")
        print("\nPossible issues:")
        print("  1. TypeScript cache — try: rm -rf node_modules/.cache")
        print("  2. Package references — check if tsconfig has 'references' field")
        print("  3. Workspace resolution — pnpm might need --workspace-root flag")
        print("\nNext: Try running with workspace resolution:")
        print("  cd ~/r3v4")
        print("  pnpm tsc --noEmit --project tsconfig.json")
    else:
        print("\n❌ Issues found — see above")
    
    print()

if __name__ == "__main__":
    main()
