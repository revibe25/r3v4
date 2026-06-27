#!/usr/bin/env python3
"""
WIRE.txt Final: Fix shared package structure + strict root excludes
"""
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

DRY_RUN = "--check" in __import__("sys").argv
APPLY = "--apply" in __import__("sys").argv

def main():
    print("🔧 Final tsconfig.json Repair\n")
    
    # Fix 1: shared/tsconfig.json - flat structure, not src/
    shared_config = json.load(open("shared/tsconfig.json"))
    print("📄 shared/tsconfig.json")
    print("   Current include: src/**/* (❌ wrong - shared is flat)")
    
    shared_config["include"] = ["*.ts"]
    shared_config["exclude"] = ["dist", "node_modules", "types/**/*"]
    print("   ✓ Fixed: include = ['*.ts']")
    print("   ✓ Fixed: exclude = ['dist', 'node_modules', 'types/**/*']\n")
    
    # Fix 2: Root tsconfig - strict dist excludes
    root_config = json.load(open("tsconfig.json"))
    print("📄 tsconfig.json (root)")
    
    # Update exclude to strictly block dist
    root_config["exclude"] = [
        "node_modules",
        "dist",
        "build",
        "**/dist",
        "**/dist/**/*",
        "packages/*/dist",
        "packages/*/dist/**/*",
        "server/dist",
        "server/dist/**/*",
        "shared/dist",
        "shared/dist/**/*",
        "**/*.test.ts",
        "**/node_modules/**/*",
    ]
    print("   ✓ Added strict dist excludes to prevent TS6305 errors\n")
    
    if DRY_RUN:
        print("🧪 DRY-RUN: Would apply above fixes")
        print("\nNew shared/tsconfig.json:")
        print(json.dumps(shared_config, indent=2))
        print("\nNew root tsconfig.json exclude:")
        print(json.dumps(root_config["exclude"], indent=2))
        print("\n✓ Dry-run complete. Run with --apply to apply.")
        return
    
    if not APPLY:
        print("⚠️  Usage:")
        print("  python3 final_tsconfig_repair.py --check")
        print("  python3 final_tsconfig_repair.py --apply\n")
        return
    
    # Apply fixes
    print("💾 Applying fixes...\n")
    
    # Backup shared
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2("shared/tsconfig.json", f"shared/tsconfig.json.backup_{timestamp}")
    with open("shared/tsconfig.json", 'w') as f:
        json.dump(shared_config, f, indent=2)
        f.write('\n')
    print(f"✓ Updated: shared/tsconfig.json")
    
    # Backup and update root
    shutil.copy2("tsconfig.json", f"tsconfig.json.backup_{timestamp}")
    with open("tsconfig.json", 'w') as f:
        json.dump(root_config, f, indent=2)
        f.write('\n')
    print(f"✓ Updated: tsconfig.json\n")
    
    # Clean all dist directories aggressively
    print("🗑️  Cleaning dist directories...\n")
    dist_dirs = [
        "shared/dist",
        "server/dist",
        "packages/llpte-signal/dist",
        "packages/llpte-ai/dist",
        "packages/llpte-core/dist",
        "packages/llpte-execution/dist",
        "packages/llpte-adapters/dist",
        "packages/llpte-transition-graph/dist",
    ]
    
    for dist_dir in dist_dirs:
        path = Path(dist_dir)
        if path.exists():
            shutil.rmtree(path)
            print(f"   ✓ {dist_dir}")
    
    # Rebuild
    print("\n🏗️  Building packages...\n")
    result = subprocess.run(["pnpm", "build"], capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ Build successful!")
    else:
        print("⚠️  Build output:")
        print(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)
        if result.stderr:
            print(result.stderr[-500:] if len(result.stderr) > 500 else result.stderr)
    
    # Typecheck
    print("\n🔬 Typechecking with pnpm tsc --noEmit...\n")
    result = subprocess.run(["pnpm", "tsc", "--noEmit"], capture_output=True, text=True)
    if result.returncode == 0:
        print("✅✅✅ TYPECHECKING PASSED! ✅✅✅")
    else:
        errors = result.stderr.split('\n')[:30]
        print("⚠️  Remaining errors:")
        print('\n'.join(errors))
        print(f"\n(showing first 30 lines)")

if __name__ == "__main__":
    main()
