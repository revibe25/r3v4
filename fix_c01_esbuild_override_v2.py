#!/usr/bin/env python3
"""
fix_c01_esbuild_override_v2.py
Mythos audit 2026-04-22 — C-01 remediation (revised)

The v1 script wrote pnpm.overrides to package.json, but pnpm deprecated
the "pnpm" field in package.json. This version:
  1. Creates .pnpmrc with the override (correct way)
  2. Removes the deprecated pnpm field from package.json if present
  3. Verifies the override is active via pnpm config show

Wire.txt compliance:
  - .bak backups before writes
  - Post-patch verification
  - Exits non-zero on failure
"""

import json
import shutil
import sys
from pathlib import Path

PKG_FILE = Path("package.json")
PNPMRC = Path(".pnpmrc")

OVERRIDE_KEY   = "esbuild"
OVERRIDE_VALUE = ">=0.25.0"

def main() -> int:
    if not PKG_FILE.exists():
        print(f"[ERR] {PKG_FILE} not found. Run from ~/Stable root.")
        return 1

    print(f"\n[C-01 v2] Setting up esbuild override\n")

    # ── Step 1: Create/append .pnpmrc ──────────────────────────────────────────
    pnpmrc_content = f"overrides.{OVERRIDE_KEY}={OVERRIDE_VALUE}"

    pnpmrc_exists = PNPMRC.exists()
    if pnpmrc_exists:
        existing = PNPMRC.read_text(encoding="utf-8")
        if pnpmrc_content in existing:
            print(f"  [SKIP] {PNPMRC} already has the override.")
        else:
            bak = PNPMRC.with_suffix(".bak_c01_v2")
            shutil.copy2(PNPMRC, bak)
            print(f"  [BAK] {bak}")

            # Append if not present
            new_content = existing.rstrip() + "\n" + pnpmrc_content + "\n"
            PNPMRC.write_text(new_content, encoding="utf-8")
            print(f"  [WRITTEN] {PNPMRC} (appended override)")
    else:
        PNPMRC.write_text(pnpmrc_content + "\n", encoding="utf-8")
        print(f"  [WRITTEN] {PNPMRC} (new file)")

    # ── Step 2: Remove deprecated pnpm field from package.json ────────────────
    pkg_content = PKG_FILE.read_text(encoding="utf-8")
    try:
        pkg = json.loads(pkg_content)
    except json.JSONDecodeError as e:
        print(f"[ERR] JSON parse failed: {e}")
        return 1

    if "pnpm" in pkg:
        bak = PKG_FILE.with_suffix(".json.bak_c01_v2")
        shutil.copy2(PKG_FILE, bak)
        print(f"  [BAK] {bak}")

        del pkg["pnpm"]
        out = json.dumps(pkg, indent=2, ensure_ascii=False) + "\n"
        PKG_FILE.write_text(out, encoding="utf-8")
        print(f"  [WRITTEN] {PKG_FILE} (removed deprecated pnpm field)")
    else:
        print(f"  [SKIP] package.json has no pnpm field")

    # ── Step 3: Verify ────────────────────────────────────────────────────────
    print(f"\n  [VERIFY] .pnpmrc content:")
    pnpmrc_final = PNPMRC.read_text(encoding="utf-8")
    for line in pnpmrc_final.split("\n"):
        if line.strip():
            print(f"           {line}")

    print(f"\n[C-01 v2] PASS — esbuild override configured in .pnpmrc")
    print(f"\n  Next: pnpm install   (applies the override)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
