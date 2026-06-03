#!/usr/bin/env python3
"""
fix_llpte_paths.py

THE REAL FIX:
Railway's builder daemon is running a cached build plan that predates our
Dockerfile changes. The cached plan has no LLPTE build step, so dist/ never
gets created, so @llpte/llpte-signal can't be resolved.

Fix: add TypeScript path aliases to server/tsconfig.json that map
@llpte/* directly to the package source files. This means:
  - tsc resolves @llpte/llpte-signal → packages/llpte-signal/src/index.ts
  - No dist/ required at compile time
  - Works regardless of build order or Railway cache state

This is the correct long-term approach anyway: workspace packages should
be resolvable from source during development and CI.

The Dockerfile LLPTE build step remains correct — it produces dist/ for
the Node.js runtime (tsc compiles TS→JS, runtime needs the JS).
"""
import sys
import json
from pathlib import Path

DRY = "--apply" not in sys.argv
f = Path.home() / "Stable/server/tsconfig.json"
data = json.loads(f.read_text())
co = data["compilerOptions"]

# Current paths:
current_paths = co.get("paths", {})
print(f"Current paths: {json.dumps(current_paths, indent=2)}")

# Add @llpte/* source mappings
# Each package's src/index.ts is the entry point
llpte_packages = [
    "llpte-signal",
    "llpte-ai", 
    "llpte-core",
    "llpte-adapters",
    "llpte-execution",
    "llpte-transition-graph",
]

new_paths = dict(current_paths)
for pkg in llpte_packages:
    key = f"@llpte/{pkg}"
    # Map to the package source — tsc will compile it directly
    # The /* variant handles deep imports like @llpte/llpte-signal/utils
    new_paths[key] = [f"../packages/{pkg}/src/index.ts"]
    new_paths[f"{key}/*"] = [f"../packages/{pkg}/src/*"]

co["paths"] = new_paths

# Also ensure rootDir isn't set to something that excludes packages/
# (already not set in server tsconfig — good)

print(f"\nNew paths additions:")
for pkg in llpte_packages:
    key = f"@llpte/{pkg}"
    print(f"  {key} → {new_paths[key][0]}")

if DRY:
    print("\nDRY RUN — no files written. Re-run with --apply")
else:
    # Verify the src/index.ts files exist
    base = Path.home() / "Stable"
    missing = []
    for pkg in llpte_packages:
        src = base / f"packages/{pkg}/src/index.ts"
        if not src.exists():
            missing.append(str(src))
    if missing:
        print(f"\nWARN: These source files not found (paths may be wrong):")
        for m in missing:
            print(f"  {m}")
        print("Check with: ls packages/*/src/")
        sys.exit(1)
    
    f.write_text(json.dumps(data, indent=2) + "\n")
    print(f"\nWritten: {f}")
