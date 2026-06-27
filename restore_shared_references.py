#!/usr/bin/env python3
"""
WIRE.txt Mastery: Restore ONLY shared references in LLPTE packages
RULE: Packages can reference shared (upward dependency).
       Packages CANNOT reference each other (no cross-LLPTE refs).
"""
import json
import shutil
from datetime import datetime
from pathlib import Path

DRY_RUN = "--check" in __import__("sys").argv
APPLY = "--apply" in __import__("sys").argv

PACKAGES = {
    "packages/llpte-signal/tsconfig.json": "../../shared",
    "packages/llpte-ai/tsconfig.json": "../../shared",
    "packages/llpte-core/tsconfig.json": "../../shared",
    "packages/llpte-execution/tsconfig.json": "../../shared",
    "packages/llpte-adapters/tsconfig.json": "../../shared",
    "packages/llpte-transition-graph/tsconfig.json": "../../shared",
}

def main():
    print("🔧 Restore shared references in LLPTE packages\n")
    
    for pkg_path, shared_ref_path in PACKAGES.items():
        if not Path(pkg_path).exists():
            print(f"✗ {pkg_path} not found")
            continue
        
        with open(pkg_path) as f:
            config = json.load(f)
        
        print(f"📄 {pkg_path}")
        
        # Check if references exist
        has_refs = "references" in config
        
        if has_refs:
            print(f"   ✓ Already has references: {len(config['references'])} items")
        else:
            print(f"   ✗ Missing references array")
            config["references"] = [{"path": shared_ref_path}]
            print(f"   ✓ Will add: references[0] = {shared_ref_path}")
        
        if DRY_RUN:
            continue
        
        if not APPLY:
            continue
        
        # Backup
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup = f"{pkg_path}.backup_{timestamp}"
        shutil.copy2(pkg_path, backup)
        
        # Save
        with open(pkg_path, 'w') as f:
            json.dump(config, f, indent=2)
            f.write('\n')
        
        print(f"   💾 Backup: {backup}")
        print(f"   ✓ Updated\n")
    
    if DRY_RUN:
        print("\n✓ Dry-run complete. Run with --apply to restore references.\n")
        return
    
    if not APPLY:
        print("\n⚠️  Usage:")
        print("  python3 restore_shared_references.py --check")
        print("  python3 restore_shared_references.py --apply\n")
        return
    
    print("🏗️  Building packages...\n")
    import subprocess
    result = subprocess.run(["pnpm", "build"], capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Build successful!\n")
        
        print("🔬 Typechecking...\n")
        result = subprocess.run(["pnpm", "tsc", "--noEmit"], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("🎉🎉🎉 COMPLETE SUCCESS! 🎉🎉🎉\n")
            print("✅ R3 v4 monorepo build pipeline is FULLY OPERATIONAL")
            print("✅ All TypeScript checks passed")
        else:
            errors = result.stderr.split('\n')[:20]
            print("⚠️  Remaining type errors:")
            print('\n'.join(errors))
    else:
        print("⚠️  Build failed:")
        lines = result.stdout.split('\n')[-30:]
        print('\n'.join(lines))

if __name__ == "__main__":
    main()
