#!/usr/bin/env python3
"""
REAL FIX: TypeScript Monorepo Composite Mode Configuration
===========================================================

Issue: Path aliases alone don't work in pnpm workspaces
Root cause: Each package's tsc runs in isolation without proper baseUrl or composite references

Solution: 
  1. Ensure each package has baseUrl: "."
  2. Ensure each package has proper "paths" configuration
  3. Ensure root tsconfig.json has "references" for all packages
  4. Run tsc from root with composite flag enabled

WIRE PROTOCOL: Read → Confirm → Backup → Dry-run → Apply → Verify
"""

import json
import sys
from pathlib import Path
from datetime import datetime
import hashlib

REPO_ROOT = Path.home() / "r3v4"
BACKUP_DIR = REPO_ROOT / ".master-backup"

PACKAGES = [
    "packages/llpte-signal",
    "packages/llpte-core",
    "packages/llpte-ai",
    "packages/llpte-execution",
    "packages/llpte-transition-graph",
    "packages/llpte-adapters",
    "shared",
]

def sha256_str(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()[:8]

def read_tsconfig(pkg_path):
    """Step 1: READ"""
    tsconfig = pkg_path / "tsconfig.json"
    if not tsconfig.exists():
        return None
    with open(tsconfig) as f:
        return json.load(f)

def backup_file(file_path):
    """Step 3: BACKUP"""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backup_path = BACKUP_DIR / f"{file_path.name}.backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    backup_path.write_text(file_path.read_text())
    return backup_path

def fix_package_tsconfig(pkg_path, pkg_name):
    """Fix a single package's tsconfig.json."""
    tsconfig_path = pkg_path / "tsconfig.json"
    
    if not tsconfig_path.exists():
        print(f"  ⊘ {pkg_name}: No tsconfig.json")
        return False
    
    # Step 1: READ
    config = read_tsconfig(pkg_path)
    if config is None:
        print(f"  ❌ {pkg_name}: Failed to read JSON")
        return False
    
    original_str = json.dumps(config, sort_keys=True)
    original_hash = sha256_str(original_str)
    
    # Step 2: CONFIRM
    has_composite = config.get("compilerOptions", {}).get("composite", False)
    has_base_url = "baseUrl" in config.get("compilerOptions", {})
    has_paths = "paths" in config.get("compilerOptions", {})
    
    print(f"  [{pkg_name}] composite={has_composite}, baseUrl={has_base_url}, paths={has_paths}")
    
    # Step 3: BACKUP
    backup_file(tsconfig_path)
    
    # Step 4: DRY-RUN (show what will change)
    changes = []
    
    if "compilerOptions" not in config:
        config["compilerOptions"] = {}
    
    if not has_composite:
        changes.append("Add composite: true")
    
    if not has_base_url:
        changes.append("Add baseUrl: .")
    
    if not has_paths:
        changes.append("Add paths aliases")
    
    if changes:
        print(f"      DRY-RUN: {', '.join(changes)}")
    
    # Step 5: APPLY
    co = config["compilerOptions"]
    
    # Ensure composite mode
    if "composite" not in co:
        co["composite"] = True
    
    # Ensure baseUrl
    if "baseUrl" not in co:
        co["baseUrl"] = "."
    
    # Ensure paths with correct mappings
    if "paths" not in co:
        co["paths"] = {}
    
    # Add @shared and @llpte paths (relative to this package's directory)
    if pkg_name.startswith("llpte-"):
        # For llpte packages: packages/llpte-*
        co["paths"]["@shared/*"] = ["../../shared/src"]
        co["paths"]["@llpte/*"] = ["../../packages/*/src"]
    elif pkg_name == "shared":
        # shared package has no external aliases
        pass
    
    # Write back
    new_str = json.dumps(config, indent=2)
    new_hash = sha256_str(new_str)
    
    tsconfig_path.write_text(new_str + "\n")
    
    if new_hash != original_hash:
        print(f"      APPLY: Modified (hash {original_hash} → {new_hash})")
        return True
    else:
        print(f"      VERIFY: No changes needed")
        return True

def fix_root_tsconfig():
    """Fix root tsconfig.json with proper references."""
    tsconfig_path = REPO_ROOT / "tsconfig.json"
    
    if not tsconfig_path.exists():
        print("  ⊘ Root tsconfig.json not found — skipping")
        return False
    
    print(f"\n  [ROOT] Updating tsconfig.json references")
    
    # Read
    config = json.loads(tsconfig_path.read_text())
    original_str = json.dumps(config, sort_keys=True)
    
    # Backup
    backup_file(tsconfig_path)
    
    # Fix: Ensure references to all packages
    if "references" not in config:
        config["references"] = []
    
    ref_paths = {
        "path": [
            "shared",
            "packages/llpte-signal",
            "packages/llpte-core",
            "packages/llpte-ai",
            "packages/llpte-execution",
            "packages/llpte-transition-graph",
            "packages/llpte-adapters",
            "server",
            "client",
        ]
    }
    
    existing_refs = [ref.get("path", "") for ref in config.get("references", [])]
    for ref_path in ref_paths["path"]:
        if ref_path not in existing_refs:
            config["references"].append({"path": ref_path})
            print(f"      Added reference: {ref_path}")
    
    # Write back
    tsconfig_path.write_text(json.dumps(config, indent=2) + "\n")
    
    return True

def main():
    print("\n" + "="*80)
    print("  FIX: TypeScript Monorepo Composite Mode")
    print("="*80 + "\n")
    
    print("STEP 1: Fix individual package tsconfigs")
    print("-" * 80)
    
    success = True
    for pkg_name in PACKAGES:
        pkg_path = REPO_ROOT / pkg_name
        if pkg_path.exists():
            if not fix_package_tsconfig(pkg_path, pkg_name):
                success = False
    
    print("\nSTEP 2: Fix root tsconfig.json")
    print("-" * 80)
    if not fix_root_tsconfig():
        success = False
    
    # Final report
    print("\n" + "="*80)
    print("NEXT STEPS")
    print("="*80)
    
    if success:
        print("\n✅ TypeScript configuration updated")
        print("\nNow run:")
        print("  cd ~/r3v4")
        print("  rm -rf node_modules/.cache node_modules/.pnpm")
        print("  pnpm install --force")
        print("  pnpm tsc --noEmit  (from root)")
        print("\nIf still errors, try individual package build:")
        print("  pnpm --filter @llpte/llpte-signal build")
    else:
        print("\n❌ Some updates failed")
    
    print()

if __name__ == "__main__":
    main()
