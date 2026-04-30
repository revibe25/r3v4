#!/usr/bin/env python3
"""
r3-ui-fix.py
Fixes three confirmed bugs causing UI breakage:

  BUG 1 — theme.css --border: #bfff00 overrides Tailwind's --border token,
           turning every border in the app lime green.
  BUG 2 — main.tsx has duplicate 'import styles/theme.css' (patch ran twice).
  BUG 3 — ThemeSwitcher component is wired correctly but never mounted anywhere.

Usage:
  python3 r3-ui-fix.py              # dry-run
  python3 r3-ui-fix.py --run        # apply + .bak backups
  python3 r3-ui-fix.py --run --verify
"""

import argparse, datetime, shutil, subprocess, sys
from pathlib import Path

ROOT = Path.home() / "Stable"
SRC  = ROOT / "client/src"
TS   = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

PATCHES = [
    # ── BUG 1 ─────────────────────────────────────────────────────────────────
    # Remove --border: #bfff00 from theme.css :root.
    # This token collides with Tailwind's --border custom property, making
    # every border-border class render as solid lime green.
    # The .neon-border utility uses var(--neon-lime) directly — --border not needed.
    {
        "file":  "client/src/styles/theme.css",
        "label": "BUG 1 — Remove --border: #bfff00 (collides with Tailwind token)",
        "old":   "  --border: #bfff00;\n",
        "new":   "",
    },

    # ── BUG 2 ─────────────────────────────────────────────────────────────────
    # Remove the duplicate theme.css import from main.tsx.
    # r3-theme-patch.py ran twice (once directly, once after ASI re-ran).
    {
        "file":  "client/src/main.tsx",
        "label": "BUG 2 — Remove duplicate theme.css import from main.tsx",
        "old":   "import './styles/theme.css';\nimport './styles/theme.css';",
        "new":   "import './styles/theme.css';",
    },

    # ── BUG 3a ────────────────────────────────────────────────────────────────
    # Add ThemeSwitcher import to page-nav.tsx.
    {
        "file":  "client/src/components/page-nav.tsx",
        "label": "BUG 3a — Add ThemeSwitcher import to page-nav.tsx",
        "old":   "import { useAuthStore, selectIsAuthed } from '@/hooks/authStore';",
        "new":   (
            "import { useAuthStore, selectIsAuthed } from '@/hooks/authStore';\n"
            "import { ThemeSwitcher } from '@/components/theme-switcher';"
        ),
    },

    # ── BUG 3b ────────────────────────────────────────────────────────────────
    # Mount ThemeSwitcher in the right cluster of PageNav, before Settings.
    {
        "file":  "client/src/components/page-nav.tsx",
        "label": "BUG 3b — Mount ThemeSwitcher in PageNav right cluster",
        "old":   "        {/* Settings — no-op until panel spec is confirmed */}",
        "new":   (
            "        {/* Theme switcher */}\n"
            "        <ThemeSwitcher />\n"
            "\n"
            "        {/* Settings — no-op until panel spec is confirmed */}"
        ),
    },
]


def check_patch(patch: dict, text: str) -> tuple[bool, str]:
    count = text.count(patch["old"])
    if count == 0:
        if patch["new"] in text or (patch["new"] == "" and patch["old"] not in text):
            return False, "already applied — skipping"
        return False, "OLD string NOT FOUND"
    if count > 1:
        return False, f"OLD string found {count} times — not unique"
    return True, "ok"


VERIFY_CHECKS = [
    (
        "theme.css does NOT contain --border: #bfff00",
        ["grep", "-n", "--border: #bfff00", str(SRC / "styles/theme.css")],
        False,  # finding it = BAD
    ),
    (
        "main.tsx has exactly one theme.css import",
        ["grep", "-c", "theme.css", str(SRC / "main.tsx")],
        True,   # finding count = 1 is GOOD (grep -c returns count as stdout)
    ),
    (
        "page-nav.tsx imports ThemeSwitcher",
        ["grep", "-n", "ThemeSwitcher", str(SRC / "components/page-nav.tsx")],
        True,   # finding it = GOOD
    ),
    (
        "page-nav.tsx renders <ThemeSwitcher />",
        ["grep", "-n", "<ThemeSwitcher", str(SRC / "components/page-nav.tsx")],
        True,   # finding it = GOOD
    ),
]


def run_verify() -> int:
    print("\n── VERIFY\n")
    failures = 0
    for desc, cmd, expect_found in VERIFY_CHECKS:
        result = subprocess.run(cmd, capture_output=True, text=True)
        found  = result.returncode == 0

        # Special case: grep -c returns count in stdout, not just exit code
        if "-c" in cmd:
            count = result.stdout.strip()
            ok = count == "1"
            icon = "✅" if ok else "❌"
            print(f"   {icon}  {desc} (count={count})")
            if not ok:
                failures += 1
        elif found == expect_found:
            snippet = result.stdout.strip().splitlines()[0] if result.stdout.strip() else ""
            print(f"   ✅  {desc}")
            if snippet:
                print(f"       {snippet}")
        else:
            failures += 1
            if found and not expect_found:
                print(f"   ❌  {desc} — still present:")
                for line in result.stdout.strip().splitlines()[:3]:
                    print(f"       {line}")
            else:
                print(f"   ❌  {desc} — not found")
        print()
    return failures


def run(dry: bool, verify: bool) -> int:
    mode = "DRY-RUN" if dry else "APPLY"
    print(f"\n{'='*60}")
    print(f"  r3-ui-fix.py  [{mode}]  {TS}")
    print(f"{'='*60}\n")

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
            if "already applied" in reason:
                print(f"   ✅  Already applied — skipping\n")
            else:
                print(f"   ❌  SKIP ({reason})\n")
                errors += 1
                skipped += 1
            continue

        if dry:
            print(f"   ✔   Would patch {patch['file']}\n")
            continue

        if patch["file"] not in backed_up:
            bak = Path(str(path) + f".bak.{TS}")
            shutil.copy2(path, bak)
            print(f"   💾  Backed up → {bak.name}")
            backed_up.add(patch["file"])

        new_text = text.replace(patch["old"], patch["new"], 1)
        path.write_text(new_text, encoding="utf-8")
        print(f"   ✅  Patched\n")

    if verify:
        if dry:
            print("\n   ℹ️   --verify requires --run. Skipped.\n")
        else:
            errors += run_verify()

    print(f"\n{'='*60}")
    if errors:
        skip_note = f" ({skipped} skipped)" if skipped else ""
        print(f"  ⚠️   {errors} issue(s){skip_note} — review above")
    else:
        if dry:
            print(f"  ✅  Dry-run clean — {len(PATCHES)} patches ready")
            print(f"      Re-run with: --run --verify")
        else:
            print(f"  ✅  All patches applied")
            print(f"  ▶   cd ~/Stable && pnpm -w run typecheck")
            print(f"  ▶   Then: pnpm dev — hard-refresh browser (Ctrl+Shift+R)")
            print(f"\n  What changed:")
            print(f"    • All borders restored to design-system colors")
            print(f"    • Duplicate CSS import removed")
            print(f"    • ThemeSwitcher now visible in top-right nav")
    print(f"{'='*60}\n")
    return 1 if errors else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="R3 v4 — fix UI breakage: --border token, duplicate import, ThemeSwitcher"
    )
    parser.add_argument("--run",    action="store_true", help="Apply (default: dry-run)")
    parser.add_argument("--verify", action="store_true", help="Verify after apply (requires --run)")
    args = parser.parse_args()
    sys.exit(run(dry=not args.run, verify=args.verify))
