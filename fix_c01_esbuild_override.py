#!/usr/bin/env python3
"""
fix_c01_esbuild_override.py
Mythos audit 2026-04-22 — C-01 remediation

What this patches:
  package.json (root of ~/Stable)

  Adds "esbuild": ">=0.25.0" to the pnpm.overrides block, forcing the
  patched esbuild version across all transitive paths including
  drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild.

  Handles three cases:
    A. pnpm.overrides block already exists → inject entry if not present
    B. pnpm block exists but no overrides key → add overrides sub-key
    C. No pnpm block at all → add both pnpm and overrides

Wire.txt compliance:
  - JSON parse (not regex) for correctness.
  - .bak backup before write.
  - Asserts key present after write.
  - Exits non-zero on any failure.
"""

import json
import shutil
import sys
from pathlib import Path

TARGET = Path("package.json")
OVERRIDE_KEY   = "esbuild"
OVERRIDE_VALUE = ">=0.25.0"

def main() -> int:
    if not TARGET.exists():
        print(f"[ERR] {TARGET} not found. Run from ~/Stable root.")
        return 1

    src = TARGET.read_text(encoding="utf-8")

    try:
        pkg = json.loads(src)
    except json.JSONDecodeError as e:
        print(f"[ERR] JSON parse failed: {e}")
        return 1

    # ── Already present? ──────────────────────────────────────────────────────
    existing = pkg.get("pnpm", {}).get("overrides", {}).get(OVERRIDE_KEY)
    if existing:
        print(f"[SKIP] pnpm.overrides.{OVERRIDE_KEY} already set to '{existing}' — nothing to do.")
        return 0

    # ── Backup ────────────────────────────────────────────────────────────────
    bak = TARGET.with_suffix(".json.bak_c01")
    shutil.copy2(TARGET, bak)
    print(f"  [BAK] {bak}")

    # ── Patch ─────────────────────────────────────────────────────────────────
    if "pnpm" not in pkg:
        pkg["pnpm"] = {}
    if "overrides" not in pkg["pnpm"]:
        pkg["pnpm"]["overrides"] = {}

    pkg["pnpm"]["overrides"][OVERRIDE_KEY] = OVERRIDE_VALUE

    # ── Write — preserve 2-space indent, trailing newline ─────────────────────
    out = json.dumps(pkg, indent=2, ensure_ascii=False) + "\n"
    TARGET.write_text(out, encoding="utf-8")

    # ── Verify ────────────────────────────────────────────────────────────────
    verify = json.loads(TARGET.read_text())
    got = verify.get("pnpm", {}).get("overrides", {}).get(OVERRIDE_KEY)
    if got != OVERRIDE_VALUE:
        print(f"[ERR] Verification failed — expected '{OVERRIDE_VALUE}', got '{got}'")
        shutil.copy2(bak, TARGET)
        return 1

    print(f"  [WRITTEN] {TARGET}")
    print(f'\n[C-01] PASS — pnpm.overrides.esbuild set to "{OVERRIDE_VALUE}"')
    print("       Run: pnpm install   (to relock the override)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
