#!/usr/bin/env python3
"""
WIRE.txt: Fix shared declaration output location
shared should emit declarations in-place (root), not to dist/
because root path alias points to ./shared/* not ./shared/dist/*
"""
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

DRY_RUN = "--check" in __import__("sys").argv
APPLY = "--apply" in __import__("sys").argv

def main():
    print("🔧 Fix shared declaration output location\n")
    
    with open("shared/tsconfig.json") as f:
        config = json.load(f)
    
    print("📄 shared/tsconfig.json")
    print(f"   Current outDir: {config['compilerOptions'].get('outDir', 'NOT SET')}")
    print("   Problem: Declarations go to dist/, but path alias points to root")
    print("   ✓ Fix: Remove outDir (emit declarations in-place)\n")
    
    # Remove outDir to emit declarations alongside source
    if "outDir" in config["compilerOptions"]:
        old_outdir = config["compilerOptions"]["outDir"]
        del config["compilerOptions"]["outDir"]
    
    # Also set emitDeclarationOnly to true since we only want .d.ts files
    config["compilerOptions"]["emitDeclarationOnly"] = True
    
    if DRY_RUN:
        print("🧪 DRY-RUN: New shared/tsconfig.json compilerOptions:")
        print(json.dumps(config["compilerOptions"], indent=2))
        print("\n✓ Dry-run complete. Run with --apply to apply.")
        return
    
    if not APPLY:
        print("⚠️  Usage:")
        print("  python3 fix_shared_declarations.py --check")
        print("  python3 fix_shared_declarations.py --apply\n")
        return
    
    # Backup
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"shared/tsconfig.json.backup_{timestamp}"
    shutil.copy2("shared/tsconfig.json", backup)
    print(f"💾 Backup: {backup}\n")
    
    # Apply
    with open("shared/tsconfig.json", 'w') as f:
        json.dump(config, f, indent=2)
        f.write('\n')
    print(f"✓ Updated: shared/tsconfig.json\n")
    
    # Clean and rebuild shared
    print("🗑️  Cleaning shared build artifacts...\n")
    for f in Path("shared").glob("*.d.ts"):
        f.unlink()
    for f in Path("shared").glob("*.d.ts.map"):
        f.unlink()
    for f in Path("shared").glob("*.js"):
        f.unlink()
    for f in Path("shared").glob("*.js.map"):
        f.unlink()
    if Path("shared/dist").exists():
        shutil.rmtree("shared/dist")
    if Path("shared/.tsbuildinfo").exists():
        Path("shared/.tsbuildinfo").unlink()
    
    print("✓ Cleaned\n")
    print("🏗️  Rebuilding shared...\n")
    result = subprocess.run(["pnpm", "--filter", "@r3vibe/shared", "build"], 
                          capture_output=True, text=True)
    
    if result.returncode != 0:
        print("⚠️  Build failed:")
        print(result.stdout)
        return
    
    print("✓ Shared built successfully\n")
    
    # Verify declarations exist
    if Path("shared/index.d.ts").exists():
        print("✅ shared/index.d.ts generated\n")
        with open("shared/index.d.ts") as f:
            content = f.read()
            if "auto-level.types" in content:
                print("✅ auto-level.types is exported!\n")
            else:
                print("⚠️  auto-level.types NOT in exports\n")
    else:
        print("❌ shared/index.d.ts NOT generated\n")
        return
    
    # Now full build
    print("🏗️  Building all packages...\n")
    result = subprocess.run(["pnpm", "build"], capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Build successful!\n")
        
        print("🔬 Typechecking...\n")
        result = subprocess.run(["pnpm", "tsc", "--noEmit"], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("🎉🎉🎉 SUCCESS! 🎉🎉🎉\n")
            print("✅ R3 v4 monorepo build is FULLY OPERATIONAL")
        else:
            errors = result.stderr.split('\n')[:20]
            print("⚠️  Type errors remain:")
            print('\n'.join(errors))
    else:
        lines = result.stdout.split('\n')[-40:]
        print("⚠️  Build failed:")
        print('\n'.join(lines))

if __name__ == "__main__":
    main()
