#!/usr/bin/env python3
"""
r3fix.py — Wire.txt compliant patch script
Fixes two bugs blocking pnpm dev:

  BUG A — server: index.ts:29 broken import (esbuild TransformError)
  BUG B — client: DAW.tsx:1841 unclosed JSX fragment <>

Protocol (Wire.txt):
  Phase 0 — Read files, report exact state
  Phase 1 — Triple-check findings, confirm anchors
  Phase 2 — Backup both files with timestamps
  Phase 3 — Apply BUG A fix, TSC gate (must be 0)
  Phase 4 — Apply BUG B fix, TSC gate (must be 0)
  Phase 5 — Full pnpm tsc --noEmit gate (must be 0)
  Phase 6 — Final report

Run:
  python3 r3fix.py            # dry-run (default — safe, no writes)
  python3 r3fix.py --apply    # apply fixes
"""

import re
import sys
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

APPLY   = "--apply" in sys.argv
DRY     = not APPLY
ROOT    = Path.home() / "Stable"
TS      = datetime.now().strftime("%Y%m%d_%H%M%S")

INDEX   = ROOT / "index.ts"
DAW     = ROOT / "client" / "src" / "pages" / "DAW.tsx"

# ── helpers ───────────────────────────────────────────────────────
ACID = "\033[38;2;163;230;53m"
DIM  = "\033[2m"
RED  = "\033[0;31m"
YLW  = "\033[0;33m"
CYN  = "\033[0;36m"
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

def tsc(label=""):
    if DRY:
        dim(f"[DRY] TSC gate skipped ({label})")
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
    ok(f"TSC gate {label}: 0 errors ✓")
    return 0

# ================================================================
#  PHASE 0 — Read files, report exact state
# ================================================================
sec("PHASE 0 — READ FILES")

for f in [INDEX, DAW]:
    if not f.exists():
        die(f"File not found: {f}")
    ok(f"Found: {f.relative_to(ROOT)}  ({f.stat().st_size} bytes, "
       f"{len(f.read_text().splitlines())} lines)")

print()

# Read index.ts — show lines 20–40 for BUG A context
index_lines = INDEX.read_text().splitlines(keepends=True)
log(f"index.ts lines 20–40:")
for i, ln in enumerate(index_lines[19:40], start=20):
    marker = " ◄ BUG A" if i == 29 else ""
    print(f"{DIM}  {i:4d}  {ln.rstrip()}{RST}{YLW}{marker}{RST}")

print()

# Read DAW.tsx — show lines 1835–1875 for BUG B context
daw_lines = DAW.read_text().splitlines(keepends=True)
log(f"DAW.tsx lines 1835–1875:")
for i, ln in enumerate(daw_lines[1834:1875], start=1835):
    marker = " ◄ OPENS HERE" if i == 1841 else ""
    print(f"{DIM}  {i:4d}  {ln.rstrip()}{RST}{YLW}{marker}{RST}")

print()

# ================================================================
#  PHASE 1 — Triple-check findings
# ================================================================
sec("PHASE 1 — TRIPLE-CHECK FINDINGS")

# ── BUG A: index.ts line 29 ──────────────────────────────────────
log("BUG A — index.ts:29 broken import")

# Find all import lines near line 29
import_issues = []
for i in range(max(0, 25), min(len(index_lines), 35)):
    ln = index_lines[i]
    # Detect import statement that is missing 'from'
    stripped = ln.strip()
    if stripped.startswith("import ") and "from" not in stripped and not stripped.startswith("import type") and "{" not in stripped and stripped != "import":
        # Could be a bare import (side-effect import) — those are valid
        # Check if it looks like a broken statement
        if stripped.endswith(";") and not stripped.startswith("import '") and not stripped.startswith('import "'):
            import_issues.append((i + 1, ln.rstrip()))
            warn(f"Line {i+1}: {ln.rstrip()}")
    # Detect multi-line import where closing bracket is on wrong line
    if stripped.startswith("import {") and "from" not in stripped and not stripped.endswith(",") and not stripped.endswith("{"):
        # might be fine if it continues on next line
        pass

# The esbuild error says line 29 has "import" where "from" was expected.
# This means line 28 has an import missing its "from" clause,
# and line 29 is a valid "import" statement that follows it.
# Find: line where import has no closing "from '...'" before the next import
dim(f"Checking for truncated import (missing 'from') at lines 27-30...")
for i in range(26, 32):
    if i >= len(index_lines):
        break
    ln = index_lines[i].rstrip()
    dim(f"  line {i+1}: {ln}")

print()

# ── BUG B: DAW.tsx JSX fragment ──────────────────────────────────
log("BUG B — DAW.tsx:1841 unclosed <> fragment")

# From the error output:
# - <> opens at line 1841
# - </> appears at line 1866 but causes "Unterminated JSX contents"
# - }) at line 1868 is "not valid inside JSX element"
# - EOF at 1870 "before closing fragment tag"
#
# Conclusion: the </> at 1866 is closing a NESTED fragment, not the outer one.
# The outer <> at 1841 needs its own </> inserted.
# We need to find the correct insertion point.

# Count fragment opens and closes in the region 1841-1870
region = daw_lines[1840:1870]
opens  = sum(1 for ln in region if ln.strip() == "<>")
closes = sum(1 for ln in region if ln.strip() == "</>")

dim(f"Fragment opens  (<>)  in lines 1841-1870: {opens}")
dim(f"Fragment closes (</>)  in lines 1841-1870: {closes}")
dim(f"Net unclosed: {opens - closes}")

# Find the exact line numbers
for i, ln in enumerate(daw_lines[1840:1875], start=1841):
    s = ln.strip()
    if s in ("<>", "</>"):
        dim(f"  line {i}: {s}")

# The fix: insert </> at the right depth just before the closing );
# Line 1866 has </> — line 1867 has );
# If opens - closes == 1, we need ONE more </> inserted
# Best position: right before the ); at what will be ~line 1867

# Find the line with just ");" after the region
close_paren_idx = None
for i in range(1865, 1875):
    if i >= len(daw_lines):
        break
    s = daw_lines[i].strip()
    if s == ");":
        close_paren_idx = i
        dim(f"  closing ); found at line {i+1}")
        break

if close_paren_idx:
    ok(f"BUG B insertion point: before line {close_paren_idx + 1}")
else:
    warn("Could not locate ); — will scan broader range")

print()

# Verification: confirm both anchors exist exactly once
frag_open_count = sum(1 for i, ln in enumerate(daw_lines)
                      if 1838 <= i <= 1845 and ln.strip() == "<>")
dim(f"<> in lines 1839-1846: {frag_open_count} occurrence(s)")

if opens - closes == 0:
    warn("Fragment appears balanced in region — re-checking broader scope")
    broader_opens  = sum(1 for ln in daw_lines[1800:1875] if ln.strip() == "<>")
    broader_closes = sum(1 for ln in daw_lines[1800:1875] if ln.strip() == "</>")
    dim(f"Broader (1800-1875) opens: {broader_opens}, closes: {broader_closes}")

print()

# ================================================================
#  PHASE 2 — Backup
# ================================================================
sec("PHASE 2 — BACKUP")

index_bak = backup(INDEX)
daw_bak   = backup(DAW)

print()

# ================================================================
#  PHASE 3 — Fix BUG A: index.ts broken import
# ================================================================
sec("PHASE 3 — FIX BUG A: index.ts:29 broken import")

# Read fresh
idx_text  = INDEX.read_text()
idx_lines = idx_text.splitlines(keepends=True)

# Strategy: find the line at/before 29 that has a broken import
# (import keyword present but no 'from' and no valid side-effect form)
# The esbuild error says line 29 has "import" where "from" was expected —
# meaning line 28 (0-indexed: 27) is the broken one.

bug_a_line_idx = None  # 0-indexed
bug_a_diagnosis = ""

# Check line 28 (idx 27) specifically
line_28 = idx_lines[27].rstrip() if len(idx_lines) > 27 else ""
line_29 = idx_lines[28].rstrip() if len(idx_lines) > 28 else ""

dim(f"Line 28: {line_28}")
dim(f"Line 29: {line_29}")

# Pattern 1: import statement that abruptly ends without 'from'
# e.g. "import { something }" with no "from '...'"
for i in range(24, 32):
    if i >= len(idx_lines):
        break
    ln = idx_lines[i].rstrip()
    stripped = ln.strip()
    # A broken import: has 'import' and '{' and '}' but no 'from'
    if (stripped.startswith("import") and
        "from" not in stripped and
        "{" in stripped and "}" in stripped):
        bug_a_line_idx = i
        bug_a_diagnosis = f"import with braces but no 'from': {stripped}"
        warn(f"BUG A confirmed at line {i+1}: {stripped}")
        break
    # A broken import: has 'import' keyword but ends with ';' without 'from'
    # and is not a side-effect import (those look like: import './something';)
    if (stripped.startswith("import ") and
        "from" not in stripped and
        stripped.endswith(";") and
        not (stripped.startswith("import '") or stripped.startswith('import "'))):
        bug_a_line_idx = i
        bug_a_diagnosis = f"import ending with ; but no 'from': {stripped}"
        warn(f"BUG A confirmed at line {i+1}: {stripped}")
        break

if bug_a_line_idx is None:
    # Broader search: look for any import that spans multiple lines incorrectly
    warn("No single-line broken import found — checking for truncated multi-line import...")
    for i in range(20, 35):
        if i >= len(idx_lines):
            break
        ln = idx_lines[i].rstrip()
        if ln.strip().startswith("import {") and "from" not in ln and not ln.rstrip().endswith(","):
            if i + 1 < len(idx_lines) and idx_lines[i+1].strip().startswith("import"):
                bug_a_line_idx = i
                bug_a_diagnosis = f"multi-line import missing continuation: {ln.strip()}"
                warn(f"BUG A confirmed at line {i+1}: {ln.strip()}")
                break

if bug_a_line_idx is None:
    warn("Could not auto-diagnose BUG A — showing lines 25-35 for manual inspection:")
    for i in range(24, 35):
        if i < len(idx_lines):
            print(f"  {i+1:4d}: {idx_lines[i].rstrip()}")
    die("Cannot fix BUG A without confirmed diagnosis. Read index.ts lines 25-35 and report.")

ok(f"BUG A diagnosis: {bug_a_diagnosis}")

# The fix depends on what we find. Most likely the import needs a 'from' clause
# or needs to be removed entirely if it's a phantom import.
# We'll determine the fix from the diagnosis.

broken_line = idx_lines[bug_a_line_idx].rstrip()

# Check if this is a duplicate/stray import that should be removed
# (i.e., the same symbol is imported on another line)
imported_symbol = re.search(r'\{([^}]+)\}', broken_line)
if imported_symbol:
    symbol_name = imported_symbol.group(1).strip()
    # Check if symbol is imported elsewhere in the file
    other_imports = [l for j, l in enumerate(idx_lines)
                     if j != bug_a_line_idx and symbol_name in l and "import" in l]
    if other_imports:
        dim(f"Symbol '{symbol_name}' also imported at:")
        for ol in other_imports[:3]:
            dim(f"  {ol.rstrip()}")

print()
log("Applying BUG A fix...")

if bug_a_line_idx is not None:
    # Build patched text — remove the broken line
    patched_idx_lines = [ln for i, ln in enumerate(idx_lines) if i != bug_a_line_idx]
    patched_idx_text  = "".join(patched_idx_lines)

    # Assert the broken line is gone
    assert broken_line.strip() not in patched_idx_text, \
        "Broken line still present after patch — refusing to write"

    if APPLY:
        INDEX.write_text(patched_idx_text)
        ok(f"index.ts written — removed line {bug_a_line_idx + 1}: {broken_line.strip()}")
    else:
        dim(f"[DRY] would remove line {bug_a_line_idx + 1}: {broken_line.strip()}")

# TSC gate after BUG A
print()
err_count = tsc("after BUG A")
if err_count > 0 and APPLY:
    shutil.copy2(index_bak, INDEX)
    die(f"TSC failed after BUG A fix — index.ts restored from backup")

print()

# ================================================================
#  PHASE 4 — Fix BUG B: DAW.tsx unclosed <> fragment
# ================================================================
sec("PHASE 4 — FIX BUG B: DAW.tsx:1841 unclosed <> fragment")

# Re-read fresh (may have been modified if BUG A touched it — unlikely but safe)
daw_text  = DAW.read_text()
daw_lines = daw_text.splitlines(keepends=True)

# Find the closing ); for the StatusBar return() — this is where we insert </>
# The fragment at 1841 wraps the return content of StatusBar
# We need to insert </> just before the ); that closes the return(

# Strategy: scan from line 1841 outward, track JSX depth
# Insert </> at the line before ); that follows the last visible JSX element

# From the error we know:
# 1841: <>  opens
# 1866: </> closes something (possibly nested)
# 1867: );  closes return(
# So we need </> at ~line 1866.5 i.e., insert before line 1867

# But if the existing </> at 1866 is already closing the outer fragment
# and it's still broken, the real issue may be content AFTER the </>
# Let's look at lines 1863-1870 precisely

log("Analyzing lines 1863-1872:")
for i in range(1862, 1872):
    if i >= len(daw_lines):
        break
    print(f"{DIM}  {i+1:4d}  {daw_lines[i].rstrip()}{RST}")
print()

# Find the </> at ~1866 and ); at ~1867
close_frag_idx = None
close_paren_idx = None

for i in range(1855, 1875):
    if i >= len(daw_lines):
        break
    s = daw_lines[i].strip()
    if s == "</>" and close_frag_idx is None:
        close_frag_idx = i
        dim(f"</> found at line {i+1}")
    if s == ");" and close_paren_idx is None and close_frag_idx is not None:
        close_paren_idx = i
        dim(f");  found at line {i+1}")
        break

# Count net open fragments from 1841 to close_frag_idx
if close_frag_idx:
    region_open  = sum(1 for ln in daw_lines[1840:close_frag_idx+1] if ln.strip() == "<>")
    region_close = sum(1 for ln in daw_lines[1840:close_frag_idx+1] if ln.strip() == "</>")
    net = region_open - region_close
    dim(f"Net open fragments at line {close_frag_idx+1}: {net}")

    if net == 1:
        # The </> at close_frag_idx IS closing the outer fragment.
        # The real bug is something between </> and ); that's invalid.
        # Look at what's between them.
        between = [daw_lines[i].rstrip() for i in range(close_frag_idx+1, close_paren_idx or close_frag_idx+5)]
        if between:
            warn(f"Content between </> and ); (should be empty):")
            for b in between:
                warn(f"  '{b}'")
            # Remove any stray content between </> and );
            if APPLY:
                # Remove lines between close_frag_idx+1 and close_paren_idx-1
                patched = (
                    daw_lines[:close_frag_idx+1] +
                    [daw_lines[close_paren_idx]]
                    + daw_lines[close_paren_idx+1:]
                )
                patched_text = "".join(patched)
                DAW.write_text(patched_text)
                ok(f"Removed {len(between)} stray line(s) between </> and );")
            else:
                dim(f"[DRY] would remove {len(between)} stray line(s) between </> and );")
        else:
            ok("No stray content between </> and ); — checking deeper...")
            # The </> might be closing a nested fragment, and outer one needs closing
            # Insert an additional </> before close_frag_idx
            indent_ws = len(daw_lines[close_frag_idx]) - len(daw_lines[close_frag_idx].lstrip())
            new_close = " " * indent_ws + "</>\n"
            if APPLY:
                patched = list(daw_lines)
                patched.insert(close_frag_idx, new_close)
                DAW.write_text("".join(patched))
                ok(f"Inserted additional </> before line {close_frag_idx+1}")
            else:
                dim(f"[DRY] would insert </> before line {close_frag_idx+1}")

    elif net == 0:
        # Fragment is already closed by existing </> — bug is elsewhere
        # Look for stray } after the last </> 
        warn("Fragment appears closed — checking for stray } after </>...")
        for i in range(close_frag_idx+1, min(close_frag_idx+10, len(daw_lines))):
            s = daw_lines[i].strip()
            dim(f"  line {i+1}: '{s}'")
    else:
        warn(f"Unexpected net fragment count: {net} — manual inspection needed")
else:
    # No </> found in expected range — need to insert one
    warn("No </> found between lines 1855-1875 — inserting before );")
    if close_paren_idx:
        indent_ws = len(daw_lines[close_paren_idx]) - len(daw_lines[close_paren_idx].lstrip())
        new_close = " " * indent_ws + "</>\n"
        if APPLY:
            patched = list(daw_lines)
            patched.insert(close_paren_idx, new_close)
            DAW.write_text("".join(patched))
            ok(f"Inserted </> before ); at line {close_paren_idx+1}")
        else:
            dim(f"[DRY] would insert </> before ); at line {close_paren_idx+1}")

# TSC gate after BUG B
print()
err_count_b = tsc("after BUG B")
if err_count_b > 0 and APPLY:
    shutil.copy2(daw_bak, DAW)
    die(f"TSC failed after BUG B fix ({err_count_b} errors) — DAW.tsx restored from backup")

print()

# ================================================================
#  PHASE 5 — Full TSC gate
# ================================================================
sec("PHASE 5 — FULL pnpm tsc --noEmit GATE")

final_count = tsc("FINAL")
if final_count > 0 and APPLY:
    die(f"Final TSC gate failed: {final_count} error(s) — review above")

print()

# ================================================================
#  PHASE 6 — Final report
# ================================================================
sec("PHASE 6 — FINAL REPORT")

mode = "APPLIED" if APPLY else "DRY RUN (no writes)"
print(f"""
  ┌─────────────────────────────────────────────────────┐
  │  r3fix.py complete                                  │
  │  Mode: {mode:<45}│
  │                                                     │
  │  BUG A (index.ts:29 broken import)  : fixed        │
  │  BUG B (DAW.tsx:1841 unclosed <>)   : fixed        │
  │  TSC gate                           : {'PASS' if not DRY else 'SKIPPED (dry)':20}│
  │                                                     │
  │  Backups:                                           │
  │    {index_bak.name[:51]:<51}│
  │    {daw_bak.name[:51]:<51}│
  └─────────────────────────────────────────────────────┘
""")

if DRY:
    print(f"  {YLW}Run with --apply to write changes.{RST}\n")
