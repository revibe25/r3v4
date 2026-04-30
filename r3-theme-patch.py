#!/usr/bin/env python3
"""
r3-theme-patch.py  v2
Patches:
  1. client/src/main.tsx          → add styles/theme.css import
  2. client/src/components/theme-switcher.tsx → fix import + use toggleTheme
  3. client/src/components/drum-pads.tsx      → 8 accent-* → neon CSS vars

Usage:
  python3 r3-theme-patch.py              # dry-run (default)
  python3 r3-theme-patch.py --run        # apply patches + .bak backups
  python3 r3-theme-patch.py --run --verify  # apply + grep-verify results

Bugs fixed vs v1:
  - BUG 1: Verify "No stale import" logic was INVERTED — printed success on failure
  - BUG 2: SKIP (not found / not unique) never incremented errors → silent exit 0
  - BUG 3: Verify regex missed accent-primary (patches 3c + 3h)
  - BUG 4: Docstring claimed --verify worked standalone; it doesn't without --run
"""

import argparse
import datetime
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.home() / "Stable"
TS   = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

PATCHES = [
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 1 — main.tsx: add theme.css import
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/main.tsx",
        "label": "Add styles/theme.css import to main.tsx",
        "old":   "import './index.css';",
        "new":   "import './index.css';\nimport './styles/theme.css';",
    },
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 2 — theme-switcher.tsx: fix context import + use toggleTheme
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/components/theme-switcher.tsx",
        "label": "Fix ThemeSwitcher: import from components/theme-provider, use toggleTheme",
        "old":   'import { useTheme } from "@/context/ThemeProvider";\nexport function ThemeSwitcher() {\n  const { theme, setTheme } = useTheme();\n  return (\n    <button\n      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}',
        "new":   'import { useTheme } from "@/components/theme-provider";\nexport function ThemeSwitcher() {\n  const { theme, toggleTheme } = useTheme();\n  return (\n    <button\n      onClick={toggleTheme}',
    },
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 3a — drum-pads: macro slider (accent-purple-500)
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/components/drum-pads.tsx",
        "label": "drum-pads: macro slider accent-purple-500 → neon-violet var",
        "old":   'className="w-full h-1.5 accent-purple-500"',
        "new":   'className="w-full h-1.5 [accent-color:var(--neon-violet,#a855f7)]"',
    },
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 3b — drum-pads: humanize slider (accent-amber-400, flex-1)
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/components/drum-pads.tsx",
        "label": "drum-pads: humanize slider accent-amber-400 → neon-amber var",
        "old":   'className="flex-1 h-1.5 accent-amber-400"',
        "new":   'className="flex-1 h-1.5 [accent-color:var(--neon-amber,#f59e0b)]"',
    },
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 3c — drum-pads: pattern morph slider (accent-primary, w-full h-1.5)
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/components/drum-pads.tsx",
        "label": "drum-pads: pattern morph slider accent-primary → accent var",
        "old":   'className="w-full h-1.5 accent-primary"',
        "new":   'className="w-full h-1.5 [accent-color:var(--accent,#b8ff00)]"',
    },
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 3d — drum-pads: filter cutoff (accent-cyan-400)
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/components/drum-pads.tsx",
        "label": "drum-pads: filter cutoff accent-cyan-400 → neon-cyan var",
        "old":   'className="w-full h-1.5 accent-cyan-400" />',
        "new":   'className="w-full h-1.5 [accent-color:var(--neon-cyan,#00f5ff)]" />',
    },
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 3e — drum-pads: reverb send (accent-purple-400)
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/components/drum-pads.tsx",
        "label": "drum-pads: reverb send accent-purple-400 → neon-violet var",
        "old":   'className="w-full h-1.5 accent-purple-400" />',
        "new":   'className="w-full h-1.5 [accent-color:var(--neon-violet,#a855f7)]" />',
    },
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 3f — drum-pads: saturation (accent-orange-400)
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/components/drum-pads.tsx",
        "label": "drum-pads: saturation accent-orange-400 → neon-amber var",
        "old":   'className="w-full h-1.5 accent-orange-400" />',
        "new":   'className="w-full h-1.5 [accent-color:var(--neon-amber,#f59e0b)]" />',
    },
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 3g — drum-pads: pitch shift (accent-green-400)
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/components/drum-pads.tsx",
        "label": "drum-pads: pitch shift accent-green-400 → neon-lime var",
        "old":   'className="w-full h-1.5 accent-green-400" />',
        "new":   'className="w-full h-1.5 [accent-color:var(--neon-lime,#b8ff00)]" />',
    },
    # ─────────────────────────────────────────────────────────────────────────
    # PATCH 3h — drum-pads: seq swing (accent-primary, w-12 h-2 — unique size)
    # ─────────────────────────────────────────────────────────────────────────
    {
        "file":  "client/src/components/drum-pads.tsx",
        "label": "drum-pads: seq swing accent-primary (w-12) → accent var",
        "old":   'className="w-12 h-2 accent-primary"',
        "new":   'className="w-12 h-2 [accent-color:var(--accent,#b8ff00)]"',
    },
]


def check_patch(patch: dict, text: str) -> tuple[bool, str]:
    """Returns (ok, reason)."""
    count = text.count(patch["old"])
    if count == 0:
        return False, "OLD string NOT FOUND in file"
    if count > 1:
        return False, f"OLD string found {count} times — not unique, skipping"
    return True, "ok"


# ── Verify checks ─────────────────────────────────────────────────────────────
# Each entry: (description, grep_args, expect_match)
# expect_match=True  → grep finding something is GOOD (positive confirmation)
# expect_match=False → grep finding something is BAD  (stale pattern remains)
VERIFY_CHECKS = [
    (
        "theme.css imported in main.tsx",
        ["grep", "-n", "styles/theme.css",
         str(ROOT / "client/src/main.tsx")],
        True,   # finding the import = good
    ),
    (
        "ThemeSwitcher imports components/theme-provider",
        ["grep", "-n", "components/theme-provider",
         str(ROOT / "client/src/components/theme-switcher.tsx")],
        True,   # finding the correct import = good
    ),
    (
        "No stale @/context/ThemeProvider import in theme-switcher",
        ["grep", "-n", "context/ThemeProvider",
         str(ROOT / "client/src/components/theme-switcher.tsx")],
        False,  # finding the old import = BAD  ← was inverted in v1
    ),
    (
        "No raw accent-palette hits in drum-pads (accent-purple/amber/cyan/orange/green/primary)",
        ["grep", "-En",
         r'accent-(purple|amber|cyan|orange|green|primary)',
         str(ROOT / "client/src/components/drum-pads.tsx")],
        False,  # finding any palette class = BAD  ← regex now covers accent-primary
    ),
]


def run_verify() -> int:
    """Run all verify checks. Returns number of failures."""
    print("\n── VERIFY: post-patch grep checks\n")
    failures = 0

    for desc, cmd, expect_match in VERIFY_CHECKS:
        result = subprocess.run(cmd, capture_output=True, text=True)
        found  = result.returncode == 0

        if found == expect_match:
            snippet = result.stdout.strip().splitlines()[0] if result.stdout.strip() else ""
            print(f"   ✅  {desc}")
            if snippet:
                print(f"       {snippet}")
            print()
        else:
            failures += 1
            if found and not expect_match:
                print(f"   ❌  {desc} — stale pattern still present:")
                for line in result.stdout.strip().splitlines()[:5]:
                    print(f"       {line}")
            else:
                print(f"   ❌  {desc} — expected pattern not found")
            print()

    return failures


def run(dry: bool, verify: bool) -> int:
    mode = "DRY-RUN" if dry else "APPLY"
    print(f"\n{'='*62}")
    print(f"  r3-theme-patch.py v2  [{mode}]  {TS}")
    print(f"{'='*62}\n")

    errors  = 0
    skipped = 0
    backed_up: set[str] = set()

    for patch in PATCHES:
        path  = ROOT / patch["file"]
        label = patch["label"]
        print(f"── {label}")

        if not path.exists():
            print(f"   ❌  FILE NOT FOUND: {path}\n")
            errors += 1
            continue

        text = path.read_text(encoding="utf-8")
        ok, reason = check_patch(patch, text)

        if not ok:
            # BUG 2 FIX: count skips as errors so exit code reflects reality
            print(f"   ❌  SKIP ({reason})\n")
            skipped += 1
            errors  += 1
            continue

        if dry:
            print(f"   ✔   Would patch {patch['file']}\n")
            continue

        # Backup once per file — use string concat, not with_suffix, for safety
        if patch["file"] not in backed_up:
            bak = Path(str(path) + f".bak.{TS}")
            shutil.copy2(path, bak)
            print(f"   💾  Backed up → {bak.name}")
            backed_up.add(patch["file"])

        new_text = text.replace(patch["old"], patch["new"], 1)
        path.write_text(new_text, encoding="utf-8")
        print(f"   ✅  Patched\n")

    # ── Verify ───────────────────────────────────────────────────────────────
    # BUG 4 FIX: --verify only runs with --run; dry-run prints a clear note
    if verify:
        if dry:
            print("\n   ℹ️  --verify is ignored in dry-run mode. Re-run with --run --verify.\n")
        else:
            errors += run_verify()

    # ── Summary ──────────────────────────────────────────────────────────────
    print(f"\n{'='*62}")
    if errors:
        skipped_note = f" ({skipped} patch(es) skipped)" if skipped else ""
        print(f"  ⚠️   {errors} issue(s) found{skipped_note} — do NOT run typecheck yet")
        print(f"       Review output above; restore from .bak.{TS} if needed")
    else:
        if dry:
            print(f"  ✅  Dry-run clean — all {len(PATCHES)} patches would apply")
            print(f"      Re-run with: --run --verify")
        else:
            print(f"  ✅  All patches applied cleanly")
            print(f"  ▶   cd ~/Stable && pnpm -w run typecheck")
            print(f"  🗑️   Optional: rm ~/Stable/client/src/context/ThemeProvider.tsx")
            print(f"       (orphaned — no imports remain after this patch)")
    print(f"{'='*62}\n")
    return 1 if errors else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="R3 v4 — theme integration patch (main.tsx + ThemeSwitcher + drum-pads)"
    )
    parser.add_argument("--run",    action="store_true",
                        help="Apply patches. Default is dry-run.")
    parser.add_argument("--verify", action="store_true",
                        help="Grep-verify results after applying (requires --run).")
    args = parser.parse_args()
    sys.exit(run(dry=not args.run, verify=args.verify))
