#!/usr/bin/env python3
"""
P0 Wire Protocol Patcher — R3v4 hex violation remediation
Usage:
  python3 p0_patch.py            # dry-run: shows diffs, touches nothing
  python3 p0_patch.py --apply    # applies all patches in-place

Wire Protocol: every patch reads first, verifies the expected content exists,
then writes. If a pattern is not found the file is skipped with a warning.
"""

import sys
import os
import re
import subprocess
from pathlib import Path

DRY_RUN = "--apply" not in sys.argv
SRC_ROOT = Path(os.path.expanduser("~/Stable/client/src"))
APPLIED = []
SKIPPED = []
WARNINGS = []


def find_file(pattern: str) -> Path | None:
    """Locate a file under SRC_ROOT whose content matches `pattern`."""
    result = subprocess.run(
        ["grep", "-rl", "--include=*.tsx", "--include=*.ts", pattern, str(SRC_ROOT)],
        capture_output=True, text=True
    )
    matches = [p.strip() for p in result.stdout.splitlines() if p.strip()]
    if len(matches) == 1:
        return Path(matches[0])
    if len(matches) > 1:
        WARNINGS.append(f"Pattern '{pattern}' matched {len(matches)} files — skipping: {matches}")
    else:
        WARNINGS.append(f"Pattern '{pattern}' not found — skipping")
    return None


def patch_file(path: Path, replacements: list[tuple[str, str]], label: str):
    """
    Read file, apply regex substitutions, optionally write back.
    Each replacement is (old_regex_pattern, new_string).
    """
    original = path.read_text(encoding="utf-8")
    modified = original

    for old_pat, new_str in replacements:
        modified = re.sub(old_pat, new_str, modified)

    if modified == original:
        WARNINGS.append(f"[{label}] No changes made in {path.name} — patterns already replaced or mismatched?")
        return

    # Show diff summary
    old_lines = original.splitlines()
    new_lines = modified.splitlines()
    changed = [(i+1, o, n) for i,(o,n) in enumerate(zip(old_lines, new_lines)) if o != n]
    print(f"\n{'─'*60}")
    print(f"  [{label}]  {path.relative_to(SRC_ROOT)}")
    print(f"  {len(changed)} line(s) changed")
    for lineno, old, new in changed[:12]:
        print(f"  L{lineno:>4}  - {old.strip()}")
        print(f"         + {new.strip()}")
    if len(changed) > 12:
        print(f"  ... and {len(changed)-12} more")

    if DRY_RUN:
        print("  [DRY RUN] Not written.")
        APPLIED.append(f"[DRY RUN] {path.name} ({len(changed)} changes)")
    else:
        path.write_text(modified, encoding="utf-8")
        print("  [WRITTEN]")
        APPLIED.append(f"[WRITTEN] {path.name} ({len(changed)} changes)")


# ─────────────────────────────────────────────────────────────
# PATCH GROUP 1: DJ_* exports file
# ─────────────────────────────────────────────────────────────
dj_file = find_file("export const DJ_BLACK")
if dj_file:
    patch_file(dj_file, [
        (r"(DJ_BLACK\s*=\s*)'#000000'",   r"\g<1>'var(--dj-black)'"),
        (r"(DJ_SURFACE2\s*=\s*)'#111111'",r"\g<1>'var(--dj-surface2)'"),
        (r"(DJ_SURFACE\s*=\s*)'#0c0c0c'", r"\g<1>'var(--dj-surface)'"),
        (r"(DJ_BORDER\s*=\s*)'#222222'",  r"\g<1>'var(--dj-border)'"),
        (r"(DJ_DIM\s*=\s*)'#444444'",     r"\g<1>'var(--dj-dim)'"),
        (r"(DJ_DIMMER\s*=\s*)'#333333'",  r"\g<1>'var(--dj-dimmer)'"),
    ], "DJ exports")


# ─────────────────────────────────────────────────────────────
# PATCH GROUP 2: RED/AMBER/SURF/etc. constants block
# ─────────────────────────────────────────────────────────────
surf_file = find_file(r'const RED\s*=\s*"#ff2200"')
if surf_file:
    patch_file(surf_file, [
        (r'(const RED\s*=\s*)"#ff2200"',    r'\g<1>"var(--signal-clip)"'),
        (r'(const AMBER\s*=\s*)"#ffaa00"',  r'\g<1>"var(--signal-warn)"'),
        (r'(const BLK\s*=\s*)"#000000"',    r'\g<1>"var(--dj-black)"'),
        (r'(const SURF3\s*=\s*)"#161616"',  r'\g<1>"var(--dj-surface3)"'),
        (r'(const SURF2\s*=\s*)"#111111"',  r'\g<1>"var(--dj-surface2)"'),
        (r'(const SURF\s*=\s*)"#0c0c0c"',   r'\g<1>"var(--dj-surface)"'),
        (r'(const BORDER\s*=\s*)"#222222"', r'\g<1>"var(--dj-border)"'),
        (r'(const DIM\s*=\s*)"#444444"',    r'\g<1>"var(--dj-dim)"'),
        (r'(const DIMMER\s*=\s*)"#333333"', r'\g<1>"var(--dj-dimmer)"'),
        (r'(const MUTED\s*=\s*)"#666666"',  r'\g<1>"var(--dj-muted)"'),
    ], "SURF/RED/AMBER constants")


# ─────────────────────────────────────────────────────────────
# PATCH GROUP 3: T-object b1–b4 background shades
# ─────────────────────────────────────────────────────────────
t_obj_file = find_file(r"b1:\s*'#0f0f0f'")
if t_obj_file:
    patch_file(t_obj_file, [
        (r"b1:\s*'#0f0f0f'", "b1: 'var(--t-b1)'"),
        (r"b2:\s*'#141414'", "b2: 'var(--t-b2)'"),
        (r"b3:\s*'#1e1e1e'", "b3: 'var(--t-b3)'"),
        (r"b4:\s*'#282828'", "b4: 'var(--t-b4)'"),
    ], "T-object b1-b4")


# ─────────────────────────────────────────────────────────────
# PATCH GROUP 4: TRACK_COLORS array
# ─────────────────────────────────────────────────────────────
track_colors_file = find_file(r"TRACK_COLORS\s*=\s*\[")
if track_colors_file:
    patch_file(track_colors_file, [
        (
            r"const TRACK_COLORS\s*=\s*\['#32cd32',\s*'#22d3ee',\s*'#ff6b00',\s*'#c084fc',\s*'#f5d000'\]",
            "const TRACK_COLORS = ['var(--looper-acid-2)', 'var(--looper-cyan)', 'var(--looper-orange)', 'var(--looper-purple)', 'var(--looper-yellow)']"
        ),
    ], "TRACK_COLORS")


# ─────────────────────────────────────────────────────────────
# PATCH GROUP 5: Inline _BLACK/_SURFACE/_SURFACE2/_BORDER block
# (the local re-declarations inside the large component, ~line 915)
# ─────────────────────────────────────────────────────────────
inline_const_file = find_file(r'const _BLACK\s*=\s*"#000000"')
if inline_const_file:
    patch_file(inline_const_file, [
        (r'(const _BLACK\s*=\s*)"#000000"',   r'\g<1>"var(--dj-black)"'),
        (r'(const _SURFACE2\s*=\s*)"#111111"',r'\g<1>"var(--dj-surface2)"'),
        (r'(const _SURFACE\s*=\s*)"#0c0c0c"', r'\g<1>"var(--dj-surface)"'),
        (r'(const _BORDER\s*=\s*)"#222222"',  r'\g<1>"var(--dj-border)"'),
    ], "Inline _BLACK/_SURFACE block")


# ─────────────────────────────────────────────────────────────
# PATCH GROUP 6: Looper T-object accent colors
# (acid, cyan, orange, red, purple, yellow, pink, blue, teal, lime)
# ─────────────────────────────────────────────────────────────
t_accent_file = find_file(r"acid:\s*'#32cd32'")
if t_accent_file:
    patch_file(t_accent_file, [
        (r"acid:\s*'#32cd32'",   "acid:   'var(--looper-acid-2)'"),
        (r"cyan:\s*'#22d3ee'",   "cyan:   'var(--looper-cyan)'"),
        (r"orange:\s*'#ff6b00'", "orange: 'var(--looper-orange)'"),
        (r"red:\s*'#ff1a1a'",    "red:    'var(--looper-red)'"),
        (r"purple:\s*'#c084fc'", "purple: 'var(--looper-purple)'"),
        (r"yellow:\s*'#f5d000'", "yellow: 'var(--looper-yellow)'"),
        (r"pink:\s*'#f472b6'",   "pink:   'var(--looper-pink)'"),
        (r"blue:\s*'#3b82f6'",   "blue:   'var(--looper-blue)'"),
        (r"teal:\s*'#14b8a6'",   "teal:   'var(--looper-teal)'"),
        (r"lime:\s*'#84cc16'",   "lime:   'var(--looper-lime)'"),
    ], "T-object accent colors")


# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
print(f"\n{'═'*60}")
print(f"  P0 PATCH SUMMARY  ({'DRY RUN' if DRY_RUN else 'APPLIED'})")
print(f"{'═'*60}")
for r in APPLIED:
    print(f"  ✓  {r}")
for w in WARNINGS:
    print(f"  ⚠  {w}")
if DRY_RUN:
    print(f"\n  Re-run with --apply to write changes.")
else:
    print(f"\n  Done. Run your preflight grep to verify the drop in violations.")
    print(f"  Then open a TS check: pnpm tsc --noEmit")
