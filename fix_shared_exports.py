#!/usr/bin/env python3
"""
WIRE.txt: Fix shared/index.ts missing auto-level.types export
"""
import shutil
from datetime import datetime
from pathlib import Path

DRY_RUN = "--check" in __import__("sys").argv
APPLY = "--apply" in __import__("sys").argv

def main():
    filepath = Path("shared/index.ts")
    
    print("🔧 Fix shared/index.ts missing exports\n")
    
    with open(filepath) as f:
        original_content = f.read()
    
    print("📄 shared/index.ts")
    print("   Current exports: ./types, ./subscription.types, ./audio.types")
    print("   ❌ Missing: ./auto-level.types")
    
    # Add missing export after the first export statement
    lines = original_content.split('\n')
    new_lines = []
    inserted = False
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        # After the first export * line, insert the missing one
        if not inserted and line.startswith("export * from './types'"):
            new_lines.append("export * from './auto-level.types';")
            inserted = True
    
    new_content = '\n'.join(new_lines)
    
    print("   ✓ Will add: export * from './auto-level.types';\n")
    
    if DRY_RUN:
        print("🧪 DRY-RUN: New shared/index.ts:")
        print(new_content)
        print("\n✓ Dry-run complete. Run with --apply to apply.")
        return
    
    if not APPLY:
        print("⚠️  Usage:")
        print("  python3 fix_shared_exports.py --check")
        print("  python3 fix_shared_exports.py --apply\n")
        return
    
    # Backup
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"shared/index.ts.backup_{timestamp}"
    shutil.copy2(filepath, backup)
    print(f"💾 Backup: {backup}\n")
    
    # Apply
    with open(filepath, 'w') as f:
        f.write(new_content)
    print(f"✓ Updated: shared/index.ts\n")
    
    # Rebuild
    print("🏗️  Building packages...\n")
    import subprocess
    result = subprocess.run(["pnpm", "build"], capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Build successful!\n")
        
        # Typecheck
        print("🔬 Typechecking...\n")
        result = subprocess.run(["pnpm", "tsc", "--noEmit"], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("🎉🎉🎉 TYPECHECKING PASSED! 🎉🎉🎉\n")
            print("✅ R3 v4 build pipeline is now FULLY OPERATIONAL")
        else:
            errors = result.stderr.split('\n')[:20]
            print("⚠️  Some type errors remain:")
            print('\n'.join(errors))
    else:
        print("⚠️  Build errors:")
        lines = result.stdout.split('\n')[-30:]
        print('\n'.join(lines))

if __name__ == "__main__":
    main()
