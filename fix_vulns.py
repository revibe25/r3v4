#!/usr/bin/env python3
"""
fix_vulns.py — R3 v4 vulnerability remediation (v2)
Bugs fixed vs v1:
  - backup collision: all three package.json files now backed up with key prefix
  - unused `os` import removed
  - diff() variables now consistent with write targets
  - picomatch override changed from >=4.0.4 to 2.3.2 (avoids chokidar v2 API break)
  - pnpm.overrides.drizzle-orm kept as hard pin (preserves dual-instance TS fix)

Scope:
  - drizzle-orm: 0.39.3 -> ^0.45.2 in root deps, server deps, shared deps
  - pnpm.overrides.drizzle-orm: 0.39.3 -> 0.45.2 (hard pin, intentional)
  - pnpm.overrides.picomatch: add "2.3.2" (fixes chokidar/anymatch ReDoS)
  - vite: HELD — v5->v6 breaking; separate task
  - esbuild: HELD — resolves transitively
  - picomatch v4 path (tinyglobby): HELD — needs tailwindcss bump

Usage:
  python3 fix_vulns.py --dry-run   # preview (default)
  python3 fix_vulns.py --apply     # write + backup
"""

import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

DRY_RUN = "--apply" not in sys.argv
REPO = Path.home() / "Stable"
TS = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP_DIR = REPO / f".fix-backup-{TS}"

FILES = {
    "root":   REPO / "package.json",
    "server": REPO / "server" / "package.json",
    "shared": REPO / "shared" / "package.json",
}

# Verify all files exist before doing anything
missing = [str(p) for p in FILES.values() if not p.exists()]
if missing:
    print(f"ERROR: files not found: {missing}")
    sys.exit(1)

def load(path):
    with open(path) as f:
        return json.load(f)

def save(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

def backup(key, path):
    """Prefix backup filename with key — all three files are named package.json."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BACKUP_DIR / f"{key}-package.json"
    shutil.copy2(path, dest)
    print(f"  [backup] {path} -> {dest}")

def show_diff(label, old, new):
    if old != new:
        print(f"  CHANGE   {label}: {old!r} -> {new!r}")
    else:
        print(f"  NOCHANGE {label}: {old!r}")

# Target values — single source of truth
DRIZZLE_DEP  = "^0.45.2"
DRIZZLE_OV   = "0.45.2"   # hard pin preserves dual-instance fix; requires manual bump for patches
PICOMATCH_OV = "2.3.2"    # fixes v2 ReDoS (chokidar path); v4 path needs tailwindcss bump separately

print(f"\n{'DRY RUN' if DRY_RUN else 'APPLY'} mode  [{TS}]")
print("=" * 54)

# ── 1. root package.json ──────────────────────────────────────────────────────
print("\n[root/package.json]")
root = load(FILES["root"])

old_dep = root.get("dependencies", {}).get("drizzle-orm")
old_ov  = root.get("pnpm", {}).get("overrides", {}).get("drizzle-orm")
old_pm  = root.get("pnpm", {}).get("overrides", {}).get("picomatch")

show_diff("dependencies.drizzle-orm",       old_dep, DRIZZLE_DEP)
show_diff("pnpm.overrides.drizzle-orm",     old_ov,  DRIZZLE_OV)
show_diff("pnpm.overrides.picomatch (add)", old_pm,  PICOMATCH_OV)

if not DRY_RUN:
    backup("root", FILES["root"])
    root.setdefault("dependencies", {})["drizzle-orm"] = DRIZZLE_DEP
    root.setdefault("pnpm", {}).setdefault("overrides", {})["drizzle-orm"] = DRIZZLE_OV
    root["pnpm"]["overrides"]["picomatch"] = PICOMATCH_OV
    save(FILES["root"], root)
    print("  [wrote]  root/package.json")

# ── 2. server/package.json ────────────────────────────────────────────────────
print("\n[server/package.json]")
server = load(FILES["server"])

old_dep = server.get("dependencies", {}).get("drizzle-orm")
show_diff("dependencies.drizzle-orm", old_dep, DRIZZLE_DEP)

if not DRY_RUN:
    backup("server", FILES["server"])
    server.setdefault("dependencies", {})["drizzle-orm"] = DRIZZLE_DEP
    save(FILES["server"], server)
    print("  [wrote]  server/package.json")

# ── 3. shared/package.json ────────────────────────────────────────────────────
print("\n[shared/package.json]")
shared = load(FILES["shared"])

old_dep = shared.get("dependencies", {}).get("drizzle-orm")
show_diff("dependencies.drizzle-orm", old_dep, DRIZZLE_DEP)

if not DRY_RUN:
    backup("shared", FILES["shared"])
    shared.setdefault("dependencies", {})["drizzle-orm"] = DRIZZLE_DEP
    save(FILES["shared"], shared)
    print("  [wrote]  shared/package.json")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'=' * 54}")
if DRY_RUN:
    print("Dry run complete — no files written.")
    print("Run with --apply to execute.\n")
    print("Gaps NOT fixed here (track separately):")
    print("  - picomatch v4 path (tinyglobby<-sucrase<-tailwindcss): bump tailwindcss")
    print("  - vite <=6.4.1: v5->v6 migration assessment required")
    print("  - esbuild: resolves transitively after vite bump")
else:
    print(f"Done. Backups at: {BACKUP_DIR}\n")
    print("Next:")
    print("  pnpm install")
    print("  pnpm audit")
    print("  git add package.json server/package.json shared/package.json pnpm-lock.yaml")
    print('  git commit -m "fix: drizzle-orm 0.45.2, picomatch 2.3.2 override"')
    print("  git push")
    print("\nTrack separately:")
    print("  - picomatch v4: tailwindcss bump")
    print("  - vite v5->v6 migration")
