#!/usr/bin/env python3
"""
patch_stores2.py — R3 v4 round-2 store fixes
  • client/src/store/clip-store.ts     — _clips / _clip / _selectedClipIds
  • client/src/hooks/authStore.ts      — _useAuthStore export name
  • client/src/store/audio-store.ts    — _context → context
"""

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--root", default=str(Path.home() / "Stable/client/src"))
args = parser.parse_args()

ROOT    = Path(args.root)
DRY_RUN = args.dry_run
TS      = datetime.now().strftime("%Y%m%d_%H%M%S")
ERRORS  = 0


def backup(path: Path) -> None:
    bak = path.with_suffix(f".ts.bak-{TS}")
    shutil.copy2(path, bak)
    print(f"  bak → {bak.name}")


def exact_replace(src: str, old: str, new: str, label: str) -> str:
    count = src.count(old)
    assert count == 1, (
        f"ASSERT FAIL [{label}]: expected 1, found {count}\n  needle: {old!r}"
    )
    return src.replace(old, new, 1)


def patch_file(path: Path, ops: list[tuple[str, str, str]]) -> None:
    global ERRORS
    print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}Patching {path} …")
    if not path.exists():
        print(f"  ERROR: not found — {path}", file=sys.stderr)
        ERRORS += 1
        return

    original = path.read_text(encoding="utf-8")
    result   = original
    local_errors = 0

    for old, new, label in ops:
        try:
            result = exact_replace(result, old, new, label)
            print(f"  ✓ {label}")
        except AssertionError as exc:
            print(f"  ✗ {exc}", file=sys.stderr)
            local_errors += 1
            ERRORS += 1

    if local_errors:
        print("  Aborting write for this file.", file=sys.stderr)
        return

    if DRY_RUN:
        import difflib
        sys.stdout.writelines(difflib.unified_diff(
            original.splitlines(keepends=True),
            result.splitlines(keepends=True),
            fromfile=str(path), tofile=str(path) + " (patched)",
        ))
    else:
        backup(path)
        path.write_text(result, encoding="utf-8")
        print("  written.")


# ── clip-store.ts ─────────────────────────────────────────────────────────────
# Seven _name → name fixes; each needle extended to be unique.

CLIP_OPS: list[tuple[str, str, str]] = [
    # addClip — _clips
    (
        "        const _clips = new Map(get().clips);\n"
        "        clips.set(clip.id, clip);\n"
        "        set({ clips });",
        "        const clips = new Map(get().clips);\n"
        "        clips.set(clip.id, clip);\n"
        "        set({ clips });",
        "addClip: _clips → clips",
    ),
    # removeClip — _clips + _selectedClipIds (collapsed into one op for uniqueness)
    (
        "        const _clips = new Map(get().clips);\n"
        "        clips.delete(id);\n"
        "        const _selectedClipIds = new Set(get().selectedClipIds);\n"
        "        selectedClipIds.delete(id);\n"
        "        set({ clips, selectedClipIds });",
        "        const clips = new Map(get().clips);\n"
        "        clips.delete(id);\n"
        "        const selectedClipIds = new Set(get().selectedClipIds);\n"
        "        selectedClipIds.delete(id);\n"
        "        set({ clips, selectedClipIds });",
        "removeClip: _clips + _selectedClipIds → unprefix",
    ),
    # updateClip — _clips + _clip
    (
        "        const _clips = new Map(get().clips);\n"
        "        const _clip = clips.get(id);\n"
        "        if (clip) {\n"
        "          clips.set(id, { ...clip, ...updates });\n"
        "          set({ clips });\n"
        "        }",
        "        const clips = new Map(get().clips);\n"
        "        const clip = clips.get(id);\n"
        "        if (clip) {\n"
        "          clips.set(id, { ...clip, ...updates });\n"
        "          set({ clips });\n"
        "        }",
        "updateClip: _clips + _clip → unprefix",
    ),
    # selectClip — _selectedClipIds
    (
        "        const _selectedClipIds = multiSelect\n"
        "          ? new Set(get().selectedClipIds)\n"
        "          : new Set<string>();\n"
        "        selectedClipIds.add(id);\n"
        "        set({ selectedClipIds });",
        "        const selectedClipIds = multiSelect\n"
        "          ? new Set(get().selectedClipIds)\n"
        "          : new Set<string>();\n"
        "        selectedClipIds.add(id);\n"
        "        set({ selectedClipIds });",
        "selectClip: _selectedClipIds → selectedClipIds",
    ),
    # deselectClip — _selectedClipIds
    (
        "        const _selectedClipIds = new Set(get().selectedClipIds);\n"
        "        selectedClipIds.delete(id);\n"
        "        set({ selectedClipIds });",
        "        const selectedClipIds = new Set(get().selectedClipIds);\n"
        "        selectedClipIds.delete(id);\n"
        "        set({ selectedClipIds });",
        "deselectClip: _selectedClipIds → selectedClipIds",
    ),
]

# ── authStore.ts ──────────────────────────────────────────────────────────────

AUTH_OPS: list[tuple[str, str, str]] = [
    (
        "export const _useAuthStore = create<AuthState>(",
        "export const useAuthStore = create<AuthState>(",
        "authStore: _useAuthStore → useAuthStore",
    ),
]

# ── audio-store.ts ────────────────────────────────────────────────────────────

AUDIO_OPS: list[tuple[str, str, str]] = [
    (
        "              const _context = getAudioContext();\n"
        "              await context.resume();",
        "              const context = getAudioContext();\n"
        "              await context.resume();",
        "audio-store: _context → context",
    ),
]

patch_file(ROOT / "store/clip-store.ts",  CLIP_OPS)
patch_file(ROOT / "hooks/authStore.ts",   AUTH_OPS)
patch_file(ROOT / "store/audio-store.ts", AUDIO_OPS)

print()
if ERRORS:
    print(f"FAILED — {ERRORS} assertion error(s). No files written.", file=sys.stderr)
    sys.exit(1)
elif DRY_RUN:
    print("Dry-run complete.")
else:
    print("Done. Run: pnpm exec tsc --noEmit 2>&1 | grep 'store/'")
