#!/usr/bin/env python3
"""
r3_master_fix.py — Wire.txt-compliant master fix script
Generated: 2026-05-09 | Ref: health.txt session analysis

────────────────────────────────────────────────────────────────────────────
SCOPE
────────────────────────────────────────────────────────────────────────────

BUCKET 4 — PageNav per-page duplicate cleanup (10 surgical removals, 6 files)
  Root cause: App.tsx:169 already mounts <PageNav /> at shell level. PRD v4.1
  sweep inconsistently left per-page mounts and dead imports across five pages.
  instrument.tsx additionally had its import added by the prior session fix,
  which was symptom-correct but architecturally wrong.

  JSX removals (4):
    client/src/pages/instrument.tsx       line 1379
    client/src/pages/visuals.tsx          line  340
    client/src/pages/vst.tsx              line  233
    client/src/pages/AdminPage.tsx        line  104

  Import removals (6):
    client/src/pages/instrument.tsx
    client/src/pages/visuals.tsx
    client/src/pages/vst.tsx
    client/src/pages/AdminPage.tsx
    client/src/pages/DAW.tsx              (dead import, JSX already removed)
    client/src/pages/collaborative-daw-pro.tsx  (same)

BUCKET 1 — Underscore-prefix codemod reversal (≈20 TS2304/TS2552 errors)
  Root cause: a botched ESLint/Biome autofix prefixed USE SITES with _ while
  leaving declarations unchanged. Every error has an explicit tsc "Did you
  mean X?" hint confirming the rename direction is safe.

  client/src/audio/core/audio-graph.ts         _audioGraph       → audioGraph
  client/src/audio/mixer/solo-manager.ts       _soloManager      → soloManager
  client/src/audio/transport/transport-engine.ts _transportEngine → transportEngine
  client/src/services/upload.ts               _cfg              → cfg
  client/src/store/index.ts                   6 import renames   (see STORE_RENAMES)

OUT OF SCOPE (not touched by this script)
  Bucket 2 — AudioWorklet tsconfig false positives (needs client/tsconfig.json audit)
  Bucket 3 — Real type drift in LoopStation505, DAW, collaborative-daw-pro, login

────────────────────────────────────────────────────────────────────────────
USAGE
────────────────────────────────────────────────────────────────────────────
  # Dry-run all buckets (default — no files written)
  python3 tools/r3_master_fix.py

  # Apply all buckets
  python3 tools/r3_master_fix.py --apply

  # Single bucket, dry-run
  python3 tools/r3_master_fix.py --bucket 4
  python3 tools/r3_master_fix.py --bucket 1

  # Single bucket, apply
  python3 tools/r3_master_fix.py --bucket 4 --apply
  python3 tools/r3_master_fix.py --bucket 1 --apply

WIRE.TXT VERIFY STEP (after --apply)
  cd ~/Stable && pnpm verify:client 2>&1 | tee /tmp/tsc-after-master-fix.log
  grep -E 'error TS' /tmp/tsc-after-master-fix.log | grep -v 'LoopStation\|DAW\|collaborative\|login\|worklet\|processor'
  # Expected: zero lines from Bucket 1 + Bucket 4 files
"""

import re
import sys
import shutil
import difflib
from pathlib import Path
from datetime import datetime

# ── CLI ───────────────────────────────────────────────────────────────────────

APPLY  = "--apply"    in sys.argv
BUCKET = None
if "--bucket" in sys.argv:
    idx = sys.argv.index("--bucket")
    try:
        BUCKET = int(sys.argv[idx + 1])
    except (IndexError, ValueError):
        print("ERROR: --bucket requires an integer argument (1 or 4)")
        sys.exit(1)

RUN_B4 = (BUCKET is None or BUCKET == 4)
RUN_B1 = (BUCKET is None or BUCKET == 1)
ROOT   = Path.home() / "Stable"

# ── Helpers ───────────────────────────────────────────────────────────────────

def backup(path: Path) -> Path:
    ts  = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = path.with_suffix(path.suffix + f".bak-{ts}")
    shutil.copy2(path, bak)
    return bak


def show_diff(original: str, patched: str, label: str, context: int = 3) -> None:
    diff = list(difflib.unified_diff(
        original.splitlines(keepends=True),
        patched.splitlines(keepends=True),
        fromfile=label,
        tofile=f"{label} (patched)",
        n=context,
    ))
    if diff:
        # Cap diff output so large files stay readable
        print("".join(diff[:80]))
    else:
        print("  (no diff — already patched?)")


def write_file(path: Path, content: str, original: str, label: str) -> None:
    """Show diff, take backup, write. No-op in dry-run mode."""
    show_diff(original, content, label)
    if APPLY:
        bak = backup(path)
        path.write_text(content, encoding="utf-8")
        print(f"  WROTE:  {path}")
        print(f"  BACKUP: {bak}")
    else:
        print("  DRY-RUN — re-run with --apply to commit")


def section(title: str) -> None:
    print(f"\n{'─' * 70}")
    print(f"  {title}")
    print(f"{'─' * 70}")


def check_exists(path: Path) -> bool:
    if not path.exists():
        print(f"  ERROR: file not found — {path}")
        return False
    return True


# ── Track errors across all operations ───────────────────────────────────────

ERRORS: list[str] = []
CHANGES: list[str] = []


# ════════════════════════════════════════════════════════════════════════════
# BUCKET 4 — PageNav per-page cleanup
# ════════════════════════════════════════════════════════════════════════════

# Pages that have BOTH the import and JSX usage (JSX must be removed first,
# then import). Order within the list doesn't matter — each file is handled
# atomically (single read → both edits → single write).
PAGENAV_FULL = [
    "client/src/pages/instrument.tsx",
    "client/src/pages/visuals.tsx",
    "client/src/pages/vst.tsx",
    "client/src/pages/AdminPage.tsx",
]

# Pages that have only the dead import (JSX was already removed in PRD v4.1).
PAGENAV_IMPORT_ONLY = [
    "client/src/pages/DAW.tsx",
    "client/src/pages/collaborative-daw-pro.tsx",
]

PAGENAV_IMPORT_LINE = "import { PageNav } from '@/components/page-nav';"


def bucket4_remove_pagenav(rel_path: str, has_jsx: bool) -> None:
    path = ROOT / rel_path
    label = rel_path
    print(f"\n  ── {label}")

    if not check_exists(path):
        ERRORS.append(f"NOT FOUND: {rel_path}")
        return

    src = path.read_text(encoding="utf-8")
    patched = src

    # ── 1. JSX removal ────────────────────────────────────────────────────────
    if has_jsx:
        jsx_lines = [ln for ln in src.splitlines() if "<PageNav />" in ln]
        count = len(jsx_lines)
        print(f"  JSX  '<PageNav />' occurrences: {count}")

        assert count == 1, (
            f"ABORT: expected exactly 1 '<PageNav />' line in {rel_path}, "
            f"found {count}. Read the file before proceeding."
        )

        # Remove the line containing <PageNav /> (preserve surrounding newlines)
        lines = patched.splitlines(keepends=True)
        jsx_idx = next(i for i, ln in enumerate(lines) if "<PageNav />" in ln)
        lines.pop(jsx_idx)
        patched = "".join(lines)

    # ── 2. Import removal ─────────────────────────────────────────────────────
    import_occurrences = patched.count(PAGENAV_IMPORT_LINE)
    print(f"  IMPORT '{PAGENAV_IMPORT_LINE}' occurrences: {import_occurrences}")

    assert import_occurrences == 1, (
        f"ABORT: expected exactly 1 PageNav import line in {rel_path}, "
        f"found {import_occurrences}. Read the file before proceeding."
    )

    # Remove the import line and its trailing newline
    lines = patched.splitlines(keepends=True)
    imp_idx = next(i for i, ln in enumerate(lines) if PAGENAV_IMPORT_LINE in ln)
    lines.pop(imp_idx)
    patched = "".join(lines)

    # ── 3. Sanity: line count should be (1 or 2) fewer than original ──────────
    orig_count   = len(src.splitlines())
    patch_count  = len(patched.splitlines())
    expected_del = (1 if has_jsx else 0) + 1  # JSX line + import line
    actual_del   = orig_count - patch_count
    assert actual_del == expected_del, (
        f"ABORT: expected to remove {expected_del} lines, removed {actual_del}. "
        f"Inspect diff before proceeding."
    )

    write_file(path, patched, src, label)
    CHANGES.append(f"Bucket4 {rel_path}: removed {'JSX + ' if has_jsx else ''}import")


def run_bucket4() -> None:
    section("BUCKET 4 — PageNav per-page cleanup")
    print("""
  Root cause: App.tsx:169 is the canonical shell-level PageNav mount.
  Per-page mounts duplicate it; per-page imports are dead code.
  This script removes 4 JSX lines + 6 import lines across 6 files.
  App.tsx is NOT touched.
""")

    for rel in PAGENAV_FULL:
        bucket4_remove_pagenav(rel, has_jsx=True)

    for rel in PAGENAV_IMPORT_ONLY:
        bucket4_remove_pagenav(rel, has_jsx=False)


# ════════════════════════════════════════════════════════════════════════════
# BUCKET 1 — Underscore-prefix codemod reversal
# ════════════════════════════════════════════════════════════════════════════

# Files with a single underscore-prefixed name to rename everywhere in the file.
# The non-underscore form is the declaration; the underscore form is the mistake.
# Safety rule: assert the correct (non-underscore) form exists in the file as a
# declaration before touching anything — prevents blind renaming if the file
# was restructured since the error was logged.
SINGLE_RENAMES = [
    {
        "file":    "client/src/audio/core/audio-graph.ts",
        "old":     "_audioGraph",
        "new":     "audioGraph",
        "errors":  4,
        "note":    "TS2552 × 4 on lines 348-351",
    },
    {
        "file":    "client/src/audio/mixer/solo-manager.ts",
        "old":     "_soloManager",
        "new":     "soloManager",
        "errors":  4,
        "note":    "TS2304 × 4 on lines 415-418",
    },
    {
        "file":    "client/src/audio/transport/transport-engine.ts",
        "old":     "_transportEngine",
        "new":     "transportEngine",
        "errors":  3,
        "note":    "TS2552 × 3 on lines 80-81",
    },
    {
        "file":    "client/src/services/upload.ts",
        "old":     "_cfg",
        "new":     "cfg",
        "errors":  4,
        "note":    "TS2304 × 4 on lines 7 and 10",
    },
]

# store/index.ts has six distinct import-level renames
STORE_RENAMES = [
    ("_selectChannelCount",    "selectChannelCount"),
    ("_selectHasSoloChannels", "selectHasSoloChannels"),
    ("_selectCPUUsage",        "selectCPUUsage"),
    ("_selectMemoryUsage",     "selectMemoryUsage"),
    ("_selectLatency",         "selectLatency"),
    ("_selectHasAlerts",       "selectHasAlerts"),
]


def whole_word_replace(src: str, old: str, new: str) -> tuple[str, int]:
    """Replace all whole-word occurrences of `old` with `new`.
    Word boundary prevents _audioGraph from also matching _audioGraphNode."""
    pattern = re.compile(r'\b' + re.escape(old) + r'\b')
    count   = len(pattern.findall(src))
    result  = pattern.sub(new, src)
    return result, count


def bucket1_single_rename(fix: dict) -> None:
    path  = ROOT / fix["file"]
    label = fix["file"]
    print(f"\n  ── {label}")
    print(f"  '{fix['old']}' → '{fix['new']}' | {fix['note']}")

    if not check_exists(path):
        ERRORS.append(f"NOT FOUND: {fix['file']}")
        return

    src = path.read_text(encoding="utf-8")

    old_count = src.count(fix["old"])
    new_decl  = src.count(fix["new"])
    print(f"  Occurrences of '{fix['old']}': {old_count}")
    print(f"  Occurrences of '{fix['new']}' (declaration): {new_decl}")

    if old_count == 0:
        print(f"  SKIP: '{fix['old']}' not found — already patched or file changed")
        return

    # Safety: the canonical declaration must exist
    assert new_decl > 0, (
        f"ABORT: '{fix['new']}' not found in {fix['file']}. "
        "The declaration may have moved. Read the file before proceeding."
    )

    patched, replaced = whole_word_replace(src, fix["old"], fix["new"])

    assert replaced == old_count, (
        f"Replace count mismatch: counted {old_count} but replaced {replaced}"
    )
    assert len(patched.splitlines()) == len(src.splitlines()), (
        f"Line count changed ({len(src.splitlines())} → {len(patched.splitlines())}) — aborting"
    )

    write_file(path, patched, src, label)
    CHANGES.append(f"Bucket1 {fix['file']}: {replaced} rename(s) '{fix['old']}' → '{fix['new']}'")


def bucket1_store_renames() -> None:
    path  = ROOT / "client/src/store/index.ts"
    label = "client/src/store/index.ts"
    print(f"\n  ── {label}")
    print(f"  TS2724 × 6 — underscore-prefixed import names pointing to non-underscore exports")

    if not check_exists(path):
        ERRORS.append(f"NOT FOUND: {label}")
        return

    src     = path.read_text(encoding="utf-8")
    patched = src
    renames_applied = 0

    for old, new in STORE_RENAMES:
        count = patched.count(old)
        print(f"  '{old}' → '{new}': {count} occurrence(s)")
        if count == 0:
            print(f"    SKIP: not found — already patched or file changed")
            continue
        updated, replaced = whole_word_replace(patched, old, new)
        assert replaced == count
        patched = updated
        renames_applied += count

    assert len(patched.splitlines()) == len(src.splitlines()), (
        f"Line count changed after store/index.ts renames — aborting"
    )

    if renames_applied == 0:
        print(f"  SKIP: all renames already applied")
        return

    write_file(path, patched, src, label)
    CHANGES.append(f"Bucket1 client/src/store/index.ts: {renames_applied} rename(s) applied")


def run_bucket1() -> None:
    section("BUCKET 1 — Underscore-prefix codemod reversal")
    print("""
  Root cause: a botched ESLint/Biome autofix prefixed USE SITES with _
  while leaving declarations unchanged. Every fix below has an explicit
  tsc 'Did you mean X?' hint — the rename direction is tsc-blessed.
  Whole-word regex prevents collateral damage to _audioGraphNode-style names.
""")
    for fix in SINGLE_RENAMES:
        bucket1_single_rename(fix)

    bucket1_store_renames()


# ════════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════════

def main() -> None:
    mode = "APPLY" if APPLY else "DRY-RUN"
    scope = f"bucket {BUCKET}" if BUCKET else "all buckets"

    print("=" * 70)
    print(f"  r3_master_fix.py — {mode} — {scope}")
    print("=" * 70)

    if RUN_B4:
        run_bucket4()

    if RUN_B1:
        run_bucket1()

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print(f"  SUMMARY — {mode}")
    print(f"{'=' * 70}")

    if CHANGES:
        print(f"\n  Changes ({len(CHANGES)}):")
        for c in CHANGES:
            print(f"    ✓  {c}")

    if ERRORS:
        print(f"\n  Errors ({len(ERRORS)}):")
        for e in ERRORS:
            print(f"    ✗  {e}")
        print()
        sys.exit(1)

    if not APPLY:
        print(f"""
  DRY-RUN complete — no files written.

  If the diff looks correct:
    python3 tools/r3_master_fix.py --apply

  Or apply buckets individually:
    python3 tools/r3_master_fix.py --bucket 4 --apply
    python3 tools/r3_master_fix.py --bucket 1 --apply
""")
    else:
        print(f"""
  APPLIED. Wire.txt verify step:

    cd ~/Stable && pnpm verify:client 2>&1 | tee /tmp/tsc-after-master-fix.log

  Expected after Bucket 4 + Bucket 1:
    grep -E 'error TS(2304|2552|2724)' /tmp/tsc-after-master-fix.log
    # → zero lines from Bucket 1/4 files

  Remaining errors (Bucket 3 — real type drift, not touched by this script):
    grep 'LoopStation\\|DAW.tsx\\|collaborative\\|login.tsx' /tmp/tsc-after-master-fix.log

  After verifying:
    # Confirm PageNav no longer duplicates in the browser
    # Check that grep -rn '<PageNav' ~/Stable/client/src/ only shows App.tsx:169
    grep -rn '<PageNav' ~/Stable/client/src/ --include='*.tsx'
    # Expected: exactly 1 line — App.tsx:169

  Cleanup backups once stable:
    find ~/Stable/client/src -name '*.bak-*' -newer ~/Stable/client/src/App.tsx | sort
    # Review, then move to ~/.r3-backups/ or delete
""")


if __name__ == "__main__":
    main()
