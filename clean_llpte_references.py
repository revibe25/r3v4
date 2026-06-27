#!/usr/bin/env python3
"""
WIRE.txt Mastery: Remove references from LLPTE packages
RULE: Only root tsconfig.json has references. Packages extend root only.
"""
import json
import shutil
from datetime import datetime
from pathlib import Path

PACKAGES = [
    "packages/llpte-signal/tsconfig.json",
    "packages/llpte-ai/tsconfig.json",
    "packages/llpte-execution/tsconfig.json",
    "packages/llpte-adapters/tsconfig.json",
    "packages/llpte-transition-graph/tsconfig.json",
]

DRY_RUN = "--check" in __import__("sys").argv
APPLY = "--apply" in __import__("sys").argv

def main():
    print("🔧 Removing references from LLPTE packages\n")
    
    for pkg_path in PACKAGES:
        if not Path(pkg_path).exists():
            print(f"✗ {pkg_path} not found")
            continue
        
        with open(pkg_path) as f:
            config = json.load(f)
        
        has_refs = "references" in config
        print(f"📄 {pkg_path}")
        
        if has_refs:
            ref_count = len(config["references"])
            print(f"   ✓ Found {ref_count} references to remove")
        else:
            print(f"   ✓ No references (clean)")
            continue
        
        if DRY_RUN:
            continue
        
        if not APPLY:
            continue
        
        # Remove references
        del config["references"]
        
        # Backup
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = f"{pkg_path}.backup_{timestamp}"
        shutil.copy2(pkg_path, backup)
        
        # Save
        with open(pkg_path, 'w') as f:
            json.dump(config, f, indent=2)
            f.write('\n')
        
        print(f"   💾 Backup: {backup}")
        print(f"   ✓ Updated: {pkg_path}\n")
    
    if DRY_RUN:
        print("\n🧪 DRY-RUN complete. Run with --apply to remove references.\n")
        return
    
    if not APPLY:
        print("\n⚠️  Usage:")
        print("  python3 clean_llpte_references.py --check")
        print("  python3 clean_llpte_references.py --apply\n")
        __import__("sys").exit(1)
    
    print("✅ All LLPTE references removed!")
    print("\n🔬 Cleaning dist directories and rebuilding...\n")
    
    import subprocess
    
    # Clean dist
    for pkg in PACKAGES:
        pkg_dir = str(Path(pkg).parent)
        dist_dir = Path(pkg_dir) / "dist"
        if dist_dir.exists():
            shutil.rmtree(dist_dir)
            print(f"   🗑️  {pkg_dir}/dist")
    
    # Rebuild
    print("\n🏗️  Building packages...\n")
    result = subprocess.run(["pnpm", "build"], capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ Build successful!")
    else:
        print("⚠️  Build had issues (check manually)")
    
    # Typecheck
    print("\n🔬 Typechecking...\n")
    result = subprocess.run(["pnpm", "tsc", "--noEmit"], capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ TYPECHECKING PASSED!")
    else:
        errors = result.stderr.split('\n')[:20]
        print("⚠️  Remaining errors:")
        print('\n'.join(errors))

if __name__ == "__main__":
    main()
