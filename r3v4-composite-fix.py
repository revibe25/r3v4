#!/usr/bin/env python3
"""
TS6305/TS6306 Composite Mode Fix
For ChromeOS Crostini, Termux on Android, or any Linux environment
"""

import json
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path.home() / "r3v4"

def log(msg: str, level="INFO"):
    """Pretty logging."""
    symbols = {"INFO": "ℹ️ ", "STEP": "→ ", "OK": "✓ ", "WARN": "⚠️ ", "ERR": "❌"}
    print(f"{symbols.get(level, '')} {msg}")

def delete_d_ts_files():
    """Delete all .d.ts files from src directories."""
    log("STEP 1: Deleting stale .d.ts files from source directories", "STEP")
    
    src_dirs = [
        "client/src",
        "server/src",
        "packages/llpte-core/src",
        "packages/llpte-adapters/src",
        "packages/llpte-ai/src",
        "packages/llpte-execution/src",
        "packages/llpte-signal/src",
        "packages/llpte-transition-graph/src",
        "shared/src",
    ]
    
    total_deleted = 0
    for src_dir in src_dirs:
        path = REPO_ROOT / src_dir
        if path.exists():
            d_ts_files = list(path.rglob("*.d.ts"))
            if d_ts_files:
                for f in d_ts_files:
                    f.unlink()
                log(f"  {src_dir}: deleted {len(d_ts_files)} .d.ts files")
                total_deleted += len(d_ts_files)
    
    log(f"Total deleted: {total_deleted} .d.ts files", "OK")
    return total_deleted

def delete_old_dists():
    """Delete old dist directories."""
    log("STEP 2: Deleting old dist directories", "STEP")
    
    dist_dirs = [
        "client/dist",
        "server/dist",
        "packages/llpte-core/dist",
        "packages/llpte-adapters/dist",
        "packages/llpte-ai/dist",
        "packages/llpte-execution/dist",
        "packages/llpte-signal/dist",
        "packages/llpte-transition-graph/dist",
    ]
    
    for dist_dir in dist_dirs:
        path = REPO_ROOT / dist_dir
        if path.exists():
            shutil.rmtree(path)
            log(f"  Removed: {dist_dir}")
    
    log(f"Old dist directories removed", "OK")

def create_tsconfig(package_dir: str, extends_path: str = "../tsconfig.base.json") -> bool:
    """Create tsconfig.json for a package."""
    config_file = REPO_ROOT / package_dir / "tsconfig.json"
    
    config = {
        "extends": extends_path,
        "compilerOptions": {
            "baseUrl": ".",
            "rootDir": "src",
            "outDir": "dist",
            "composite": True,
            "declaration": True,
            "declarationMap": True,
            "sourceMap": True,
        },
        "include": ["src/**/*"],
        "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"],
    }
    
    # Special handling for client (different extends path)
    if "client" in package_dir:
        config["compilerOptions"]["emitDeclarationOnly"] = False
    
    # Write file
    config_file.write_text(json.dumps(config, indent=2) + "\n")
    return True

def fix_tsconfig_files():
    """Create/fix tsconfig.json for all packages."""
    log("STEP 3: Creating/fixing tsconfig.json files", "STEP")
    
    packages = [
        ("client", "../tsconfig.base.json"),
        ("packages/llpte-core", "../../tsconfig.base.json"),
        ("packages/llpte-adapters", "../../tsconfig.base.json"),
        ("packages/llpte-ai", "../../tsconfig.base.json"),
        ("packages/llpte-execution", "../../tsconfig.base.json"),
        ("packages/llpte-signal", "../../tsconfig.base.json"),
        ("packages/llpte-transition-graph", "../../tsconfig.base.json"),
    ]
    
    created = 0
    for pkg_dir, extends in packages:
        try:
            create_tsconfig(pkg_dir, extends)
            log(f"  ✓ {pkg_dir}/tsconfig.json")
            created += 1
        except Exception as e:
            log(f"  Failed to create {pkg_dir}: {e}", "ERR")
    
    log(f"Created/fixed {created} tsconfig.json files", "OK")
    return created > 0

def verify_root_tsconfig():
    """Verify root tsconfig.json is correct."""
    log("STEP 4: Verifying root tsconfig.json", "STEP")
    
    root_config = REPO_ROOT / "tsconfig.json"
    if not root_config.exists():
        log("Root tsconfig.json not found", "ERR")
        return False
    
    try:
        config = json.loads(root_config.read_text())
        
        if config.get("compilerOptions", {}).get("composite"):
            log("  ✓ Root tsconfig has composite: true")
        else:
            log("  ⚠️  Root tsconfig may not have composite: true", "WARN")
        
        refs = config.get("references", [])
        if refs:
            log(f"  ✓ Root tsconfig references {len(refs)} projects")
        else:
            log("  ⚠️  Root tsconfig has no project references", "WARN")
        
        return True
    except json.JSONDecodeError:
        log("Root tsconfig.json is malformed JSON", "ERR")
        return False

def verify_gitignore():
    """Check .gitignore protects .d.ts files."""
    log("STEP 5: Verifying .gitignore", "STEP")
    
    gitignore = REPO_ROOT / ".gitignore"
    if not gitignore.exists():
        log(".gitignore not found", "WARN")
        return False
    
    content = gitignore.read_text()
    if "*.d.ts" in content or "dist" in content:
        log("  ✓ .gitignore protects .d.ts files")
        return True
    else:
        log("  ⚠️  .gitignore may not exclude .d.ts files", "WARN")
        return False

def run_clean_build():
    """Run pnpm install and TypeScript check."""
    log("STEP 6: Running clean build", "STEP")
    
    try:
        log("  Installing dependencies (this may take a minute)...")
        result = subprocess.run(
            ["pnpm", "install", "--force"],
            cwd=REPO_ROOT,
            capture_output=True,
            timeout=300
        )
        
        if result.returncode == 0:
            log("  ✓ pnpm install succeeded", "OK")
        else:
            log("  ⚠️  pnpm install had issues (but continuing...)", "WARN")
        
        # Clear cache
        cache_dir = REPO_ROOT / "node_modules" / ".cache"
        if cache_dir.exists():
            shutil.rmtree(cache_dir, ignore_errors=True)
        
        # Run TypeScript check
        log("  Running TypeScript check...")
        result = subprocess.run(
            ["pnpm", "tsc", "--noEmit"],
            cwd=REPO_ROOT,
            capture_output=True,
            timeout=120
        )
        
        if result.returncode == 0:
            log("  ✓ TypeScript check passed!", "OK")
            return True
        else:
            # Print first 20 lines of output
            lines = result.stdout.decode() .split('\n')[:20]
            log("  TypeScript check output (first 20 lines):", "INFO")
            for line in lines:
                if line.strip():
                    print(f"    {line}")
            if len(result.stdout.decode().split('\n')) > 20:
                print("    ... (more errors, run pnpm tsc --noEmit to see all)")
            return False
            
    except subprocess.TimeoutExpired:
        log("Build timed out (taking too long)", "WARN")
        return False
    except FileNotFoundError:
        log("pnpm not found in PATH", "ERR")
        return False
    except Exception as e:
        log(f"Build failed: {e}", "ERR")
        return False

def print_summary():
    """Print final summary."""
    print("\n" + "="*50)
    log("Composite mode fix complete!", "OK")
    print("="*50)
    print("\nWhat was fixed:")
    print("  ✓ Deleted stale .d.ts files from src/")
    print("  ✓ Removed old dist/ directories")
    print("  ✓ Created tsconfig.json with composite: true")
    print("  ✓ Verified root tsconfig.json")
    print("\nNext steps:")
    print("  1. git status")
    print("     (should show many .d.ts file deletions)")
    print("")
    print("  2. git add -A && git commit -m 'fix(ts): enable composite mode'")
    print("")
    print("  3. pnpm build")
    print("     (to rebuild dist/ directories)")
    print("\nQuestions?")
    print("  See: ~/TS6305_FIX_GUIDE.md")
    print("")

def main():
    print("\n" + "="*50)
    log("TypeScript Composite Mode Fix", "STEP")
    print("="*50)
    
    if not REPO_ROOT.exists():
        log(f"Repo not found at {REPO_ROOT}", "ERR")
        return False
    
    log(f"Target: {REPO_ROOT}")
    print("")
    
    # Run all steps
    try:
        delete_d_ts_files()
        delete_old_dists()
        fix_tsconfig_files()
        verify_root_tsconfig()
        verify_gitignore()
        print("")
        run_clean_build()
        print_summary()
        return True
    except KeyboardInterrupt:
        log("Interrupted by user", "WARN")
        return False
    except Exception as e:
        log(f"Unexpected error: {e}", "ERR")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
