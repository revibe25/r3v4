#!/usr/bin/env python3
"""
WIRE.txt Compliant: Root tsconfig.json Refactor
Converts from build-orchestrator hybrid to solution-only (references-based).
"""
import json
import sys
import shutil
from datetime import datetime
from pathlib import Path

DRY_RUN = "--check" in sys.argv
APPLY = "--apply" in sys.argv

def main():
    root_tsconfig = Path("tsconfig.json")
    
    if not root_tsconfig.exists():
        print("✗ tsconfig.json not found")
        sys.exit(1)
    
    # WIRE.txt Step 1: READ
    print("📖 READING tsconfig.json...")
    with open(root_tsconfig) as f:
        original = json.load(f)
    
    # Deep copy for modification
    fixed = json.loads(json.dumps(original))
    
    # Track changes
    changes = []
    
    # Step 2: REMOVE conflicting build fields
    print("\n🔍 Analyzing structure...")
    
    if "include" in fixed:
        changes.append("Removing: include (root should not compile)")
        del fixed["include"]
    
    if "exclude" in fixed:
        changes.append("Removing: exclude (root should not compile)")
        del fixed["exclude"]
    
    compiler_opts = fixed.get("compilerOptions", {})
    
    if "outDir" in compiler_opts:
        changes.append("Removing: compilerOptions.outDir (each package has own outDir)")
        del compiler_opts["outDir"]
    
    if "rootDir" in compiler_opts:
        changes.append("Removing: compilerOptions.rootDir (each package has own rootDir)")
        del compiler_opts["rootDir"]
    
    if "tsBuildInfoFile" in compiler_opts:
        changes.append("Removing: compilerOptions.tsBuildInfoFile (each package has own)")
        del compiler_opts["tsBuildInfoFile"]
    
    # Step 3: ADD references (monorepo orchestration)
    references = [
        {"path": "packages/llpte-core"},
        {"path": "packages/llpte-signal"},
        {"path": "packages/llpte-ai"},
        {"path": "packages/llpte-execution"},
        {"path": "packages/llpte-adapters"},
        {"path": "packages/llpte-transition-graph"},
        {"path": "server"},
        {"path": "shared"},
    ]
    
    fixed["references"] = references
    changes.append("Adding: references[] for monorepo orchestration")
    
    # Display changes
    print("\n📋 CHANGES:")
    for change in changes:
        print(f"  ✓ {change}")
    
    if DRY_RUN:
        print("\n🧪 DRY-RUN: Would apply above changes")
        print("\n📄 New tsconfig.json:")
        print(json.dumps(fixed, indent=2))
        print("\n✓ Dry-run complete. Run with --apply to apply changes.")
        return
    
    if not APPLY:
        print("\n⚠️  Usage:")
        print("  python3 fix_tsconfig.py --check        (dry-run)")
        print("  python3 fix_tsconfig.py --apply        (apply changes)")
        sys.exit(1)
    
    # Step 4: BACKUP (WIRE.txt)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = Path(f"tsconfig.json.backup_{timestamp}")
    shutil.copy2(root_tsconfig, backup_path)
    print(f"\n💾 Backup: {backup_path}")
    
    # Step 5: APPLY (WIRE.txt)
    print("✍️  Applying changes...")
    with open(root_tsconfig, 'w') as f:
        json.dump(fixed, f, indent=2)
        f.write('\n')
    print(f"✓ Updated: {root_tsconfig}")
    
    # Step 6: VERIFY (WIRE.txt)
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
        print("⚠️  Typechecking had errors:")
        print(result.stderr)
        print(f"\n🔙 To rollback: cp {backup_path} {root_tsconfig}")

if __name__ == "__main__":
    main()
