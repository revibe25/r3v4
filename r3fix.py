#!/usr/bin/env python3
"""
r3fix.py — Wire.txt compliant patch script
Two confirmed bugs blocking pnpm dev:

  BUG A — index.ts lines 28-29: broken split import
    Line 28: import express
    Line 29: import type { Request, Response } from 'express' from 'express';
    Fix: replace both lines with two correct imports:
      import express from 'express';
      import type { Request, Response } from 'express';

  BUG B — DAW.tsx lines 1841-1842: duplicate stray <> fragment open
    Line 1841: <>   ← correct outer open
    Line 1842: <>   ← stray duplicate — causes net +1 unclosed
    Fix: remove line 1842

Run:
  python3 r3fix.py           # dry-run (default — safe, no writes)
  python3 r3fix.py --apply   # apply fixes
"""

import sys
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

APPLY = "--apply" in sys.argv
DRY   = not APPLY
ROOT  = Path.home() / "Stable"
TS    = datetime.now().strftime("%Y%m%d_%H%M%S")

INDEX = ROOT / "index.ts"
DAW   = ROOT / "client" / "src" / "pages" / "DAW.tsx"

ACID = "\033[38;2;163;230;53m"
DIM  = "\033[2m"
RED  = "\033[0;31m"
YLW  = "\033[0;33m"
RST  = "\033[0m"

def log(m):  print(f"{ACID}▸{RST} {m}")
def dim(m):  print(f"{DIM}  {m}{RST}")
def warn(m): print(f"{YLW}⚠  {m}{RST}")
def ok(m):   print(f"{ACID}✓{RST}  {m}")
def die(m):  print(f"{RED}✗  {m}{RST}", file=sys.stderr); sys.exit(1)
def hr():    print("─" * 60)
def sec(t):  hr(); print(f"  {t}"); hr()

def backup(path):
    bak = Path(str(path) + f".bak-{TS}")
    if not DRY:
        shutil.copy2(path, bak)
        ok(f"Backup: {bak.name}")
    else:
        dim(f"[DRY] would backup → {bak.name}")
    return bak

def tsc_gate(label=""):
    if DRY:
        dim(f"[DRY] TSC gate skipped — {label}")
        return 0
    r = subprocess.run(
        ["pnpm", "tsc", "--noEmit"],
        cwd=ROOT, capture_output=True, text=True
    )
    errors = [l for l in (r.stdout + r.stderr).splitlines() if "error TS" in l]
    if errors:
        for e in errors[:15]:
            print(f"  {RED}{e}{RST}")
        return len(errors)
    ok(f"TSC gate [{label}]: 0 errors ✓")
    return 0

# ================================================================
#  PHASE 0 — Pre-flight: confirm files exist
# ================================================================
sec("PHASE 0 — PRE-FLIGHT")
for f in [INDEX, DAW]:
    f.exists() or die(f"File not found: {f}")
    ok(f"{f.relative_to(ROOT)}  ({len(f.read_text().splitlines())} lines)")

# ================================================================
#  PHASE 1 — Triple-check BUG A anchors
# ================================================================
sec("PHASE 1 — TRIPLE-CHECK BUG A (index.ts)")

idx_text  = INDEX.read_text()
idx_lines = idx_text.splitlines(keepends=True)

# Exact broken lines confirmed from dry-run output
BUG_A_LINE_28 = "import express\n"
BUG_A_LINE_29 = "import type { Request, Response } from 'express' from 'express';\n"

# Correct replacements
FIX_A_LINE_28 = "import express from 'express';\n"
FIX_A_LINE_29 = "import type { Request, Response } from 'express';\n"

# Verify line 28 (idx 27) and line 29 (idx 28) are exactly what we expect
assert len(idx_lines) >= 29, "index.ts has fewer than 29 lines"

actual_28 = idx_lines[27]
actual_29 = idx_lines[28]

dim(f"Line 28 expected: {BUG_A_LINE_28.rstrip()!r}")
dim(f"Line 28 actual  : {actual_28.rstrip()!r}")
dim(f"Line 29 expected: {BUG_A_LINE_29.rstrip()!r}")
dim(f"Line 29 actual  : {actual_29.rstrip()!r}")

# Check 1: line 28 exact match
if actual_28 != BUG_A_LINE_28:
    # Try without newline diff
    if actual_28.rstrip() == BUG_A_LINE_28.rstrip():
        ok("Line 28 matches (newline variant) ✓")
    else:
        die(f"Line 28 mismatch — expected {BUG_A_LINE_28.rstrip()!r}, got {actual_28.rstrip()!r}")
else:
    ok("Line 28 confirmed ✓")

# Check 2: line 29 exact match
if actual_29.rstrip() != BUG_A_LINE_29.rstrip():
    die(f"Line 29 mismatch — expected {BUG_A_LINE_29.rstrip()!r}, got {actual_29.rstrip()!r}")
ok("Line 29 confirmed ✓")

# Check 3: no other occurrences that would break a targeted replace
count_28 = sum(1 for l in idx_lines if l.rstrip() == BUG_A_LINE_28.rstrip())
count_29 = sum(1 for l in idx_lines if l.rstrip() == BUG_A_LINE_29.rstrip())
dim(f"'import express' occurrences: {count_28} (expect 1)")
dim(f"Broken type import occurrences: {count_29} (expect 1)")
if count_28 != 1: die(f"Expected exactly 1 occurrence of broken line 28, found {count_28}")
if count_29 != 1: die(f"Expected exactly 1 occurrence of broken line 29, found {count_29}")
ok("Anchor counts confirmed ✓")

print()

# ================================================================
#  PHASE 2 — Triple-check BUG B anchors
# ================================================================
sec("PHASE 2 — TRIPLE-CHECK BUG B (DAW.tsx)")

daw_text  = DAW.read_text()
daw_lines = daw_text.splitlines(keepends=True)

# Confirmed from dry-run: lines 1841 and 1842 are both "<>"
# Line 1841 (idx 1840): correct outer open — keep
# Line 1842 (idx 1841): stray duplicate — remove

actual_1841 = daw_lines[1840].strip()
actual_1842 = daw_lines[1841].strip()

dim(f"Line 1841: {actual_1841!r} (expect '<>')")
dim(f"Line 1842: {actual_1842!r} (expect '<>' — stray to remove)")

if actual_1841 != "<>":
    die(f"Line 1841 is not '<>' — got {actual_1841!r}. Re-read file before patching.")
ok("Line 1841 is <> ✓")

if actual_1842 != "<>":
    die(f"Line 1842 is not '<>' — got {actual_1842!r}. Stray position may have shifted.")
ok("Line 1842 is stray <> ✓")

# Check 3: net fragment count in 1841-1870 should be 1 unclosed
region_open  = sum(1 for ln in daw_lines[1840:1870] if ln.strip() == "<>")
region_close = sum(1 for ln in daw_lines[1840:1870] if ln.strip() == "</>")
net = region_open - region_close
dim(f"Region 1841-1870: {region_open} opens, {region_close} closes, net={net}")
if net != 1:
    die(f"Expected net=1 unclosed fragment, got {net} — re-check file state")
ok(f"Net fragment count confirmed: {net} (will be 0 after removing stray line 1842) ✓")

print()

# ================================================================
#  PHASE 3 — Backup both files
# ================================================================
sec("PHASE 3 — BACKUP")

idx_bak = backup(INDEX)
daw_bak = backup(DAW)

print()

# ================================================================
#  PHASE 4 — Apply BUG A fix
# ================================================================
sec("PHASE 4 — FIX BUG A: index.ts lines 28-29")

log("Before:")
dim(f"  28: {idx_lines[27].rstrip()}")
dim(f"  29: {idx_lines[28].rstrip()}")
log("After:")
dim(f"  28: {FIX_A_LINE_28.rstrip()}")
dim(f"  29: {FIX_A_LINE_29.rstrip()}")

patched_idx = list(idx_lines)
patched_idx[27] = FIX_A_LINE_28
patched_idx[28] = FIX_A_LINE_29
patched_idx_text = "".join(patched_idx)

# Post-patch assertions
assert "import express\n" not in patched_idx_text, \
    "Bare 'import express' still present after patch"
assert "import express from 'express';" in patched_idx_text, \
    "Fixed express import not found in patched text"
assert "import type { Request, Response } from 'express' from 'express'" not in patched_idx_text, \
    "Broken type import still present after patch"
assert "import type { Request, Response } from 'express';" in patched_idx_text, \
    "Fixed type import not found in patched text"

ok("Post-patch assertions passed ✓")

if APPLY:
    INDEX.write_text(patched_idx_text)
    ok(f"index.ts written ({len(patched_idx_text.splitlines())} lines)")
    # Read-back verify
    readback = INDEX.read_text()
    assert "import express from 'express';" in readback, "Read-back failed: fix not in file"
    ok("Read-back verified ✓")
else:
    dim("[DRY] would write index.ts with lines 28-29 corrected")

# TSC gate
print()
err_a = tsc_gate("BUG A")
if err_a > 0 and APPLY:
    shutil.copy2(idx_bak, INDEX)
    die(f"TSC failed after BUG A fix ({err_a} errors) — index.ts restored from backup")

print()

# ================================================================
#  PHASE 5 — Apply BUG B fix
# ================================================================
sec("PHASE 5 — FIX BUG B: DAW.tsx line 1842 stray <>")

log("Removing stray <> at line 1842 (index 1841)...")
dim(f"  Before: lines 1841-1844:")
for i in range(1840, 1844):
    dim(f"    {i+1}: {daw_lines[i].rstrip()}")

patched_daw = [ln for i, ln in enumerate(daw_lines) if i != 1841]
patched_daw_text = "".join(patched_daw)

# Post-patch assertions
# Net fragment count in region should now be 0
new_daw_lines = patched_daw_text.splitlines(keepends=True)
new_opens  = sum(1 for ln in new_daw_lines[1840:1869] if ln.strip() == "<>")
new_closes = sum(1 for ln in new_daw_lines[1840:1869] if ln.strip() == "</>")
new_net    = new_opens - new_closes
dim(f"Post-patch region 1841-1869: {new_opens} opens, {new_closes} closes, net={new_net}")
if new_net != 0:
    die(f"Fragment still unbalanced after patch: net={new_net} — refusing to write")
ok(f"Fragment balanced after patch: net={new_net} ✓")

# Line count check
assert len(patched_daw) == len(daw_lines) - 1, \
    f"Expected {len(daw_lines)-1} lines after removal, got {len(patched_daw)}"
ok(f"Line count: {len(daw_lines)} → {len(patched_daw)} (removed exactly 1 line) ✓")

log("After:")
for i in range(1840, 1844):
    if i < len(new_daw_lines):
        dim(f"    {i+1}: {new_daw_lines[i].rstrip()}")

if APPLY:
    DAW.write_text(patched_daw_text)
    ok(f"DAW.tsx written ({len(patched_daw)} lines)")
    readback = DAW.read_text().splitlines()
    assert readback[1840].strip() == "<>",  "Read-back: line 1841 is not <>"
    assert readback[1841].strip() != "<>",  "Read-back: stray <> still at line 1842"
    ok("Read-back verified ✓")
else:
    dim("[DRY] would write DAW.tsx with line 1842 removed")

# TSC gate
print()
err_b = tsc_gate("BUG B")
if err_b > 0 and APPLY:
    shutil.copy2(daw_bak, DAW)
    die(f"TSC failed after BUG B fix ({err_b} errors) — DAW.tsx restored from backup")

print()

# ================================================================
#  PHASE 6 — Full pnpm tsc --noEmit gate
# ================================================================
sec("PHASE 6 — FULL pnpm tsc --noEmit GATE")

final = tsc_gate("FINAL")
if final > 0 and APPLY:
    die(f"Final TSC gate failed: {final} error(s)")

print()

# ================================================================
#  PHASE 7 — Final report
# ================================================================
sec("PHASE 7 — FINAL REPORT")

mode = "APPLIED" if APPLY else "DRY RUN — no files written"
print(f"""
  ┌──────────────────────────────────────────────────────────┐
  │  r3fix.py complete                                       │
  │  Mode   : {mode:<49}│
  │                                                          │
  │  BUG A  index.ts:28-29  broken express import   FIXED   │
  │  BUG B  DAW.tsx:1842    stray <> fragment       FIXED   │
  │  TSC    {'PASS (0 errors)' if not DRY else 'SKIPPED (dry run)':<49}│
  │                                                          │
  │  Backups:                                                │
  │    {idx_bak.name[:55]:<55}│
  │    {daw_bak.name[:55]:<55}│
  └──────────────────────────────────────────────────────────┘
""")

if DRY:
    print(f"  {YLW}Run with --apply to write changes.{RST}\n")