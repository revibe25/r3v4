#!/usr/bin/env python3
"""
r3-fix-index.py
Repairs server/index.ts: billing block inserted inside express.json({...}).

Root cause: r3-fix-remaining.py found 'express.json(' and inserted the billing
block immediately after that line — splitting the express.json object literal.
The limit:/verify: properties ended up below the billing block instead of
inside the call where they belong.

Broken:                         Correct:
  app.use(                        app.use(
    express.json({                  express.json({
                                      limit: "50mb",
  // Billing route...     ->          verify: ...,
  if (stripe) { ... }               }),
      limit: "50mb",              );
      verify: ...,                // Billing route...
    }),                           if (stripe) { ... }
  );

Run from project root: python3 r3-fix-index.py
"""

import re
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parent.resolve()
os.chdir(ROOT)

GRN = '\033[0;32m'; RED = '\033[0;31m'; RESET = '\033[0m'
def ok(m):   print(f"  {GRN}\u2705{RESET} {m}")
def fail(m): print(f"  {RED}\u274c{RESET} {m}")
def info(m): print(f"     {m}")


def read_file(p: Path) -> str:
    """Read file — surfaces actionable error, no raw traceback."""
    try:
        return p.read_text(encoding='utf-8')
    except OSError as e:
        fail(f"Cannot read {p}: {e}")
        sys.exit(1)


def write_file(p: Path, content: str) -> None:
    """Write file — surfaces actionable error, no raw traceback."""
    try:
        p.write_text(content, encoding='utf-8')
    except OSError as e:
        fail(f"Cannot write {p}: {e}")
        sys.exit(1)


def find_appuse_close(lines: list[str], json_open_idx: int) -> int | None:
    """
    Return the index of the line whose ';' closes the app.use(express.json(...))
    call that contains json_open_idx.

    Algorithm:
    1. Scan backward from json_open_idx to find the enclosing app.use( line.
    2. Compute brace/paren depth at the START of that app.use( line by counting
       all characters from line 0 up to (not including) the app.use( line.
       That is the depth we need to return to.
    3. Resume counting from the app.use( line forward. When depth returns to
       the baseline AND the current line ends with ';', that is the closer.

    This handles:
    - Multi-line callbacks inside verify: without false-stopping there.
    - Tab or space indentation (no indent heuristic used).
    - Files with arbitrary top-level code above app.use( (depth may be > 0).
    """
    # Step 1: locate the enclosing app.use( line
    appuse_idx = None
    for i in range(json_open_idx - 1, -1, -1):
        if re.search(r'\bapp\.use\s*\(', lines[i]):
            appuse_idx = i
            break

    # Step 2: depth at the start of the app.use( line
    # (i.e. the depth target we need to return to)
    baseline_bd = baseline_pd = 0
    scan_from = appuse_idx if appuse_idx is not None else 0
    for line in lines[:scan_from]:
        for ch in line:
            if   ch == '{': baseline_bd += 1
            elif ch == '}': baseline_bd -= 1
            elif ch == '(': baseline_pd += 1
            elif ch == ')': baseline_pd -= 1

    # Step 3: scan from app.use( (or file start) forward until depth
    # returns to baseline on a statement-terminating line.
    bd, pd = baseline_bd, baseline_pd
    for i in range(scan_from, len(lines)):
        for ch in lines[i]:
            if   ch == '{': bd += 1
            elif ch == '}': bd -= 1
            elif ch == '(': pd += 1
            elif ch == ')': pd -= 1

        # Skip the app.use( line itself — depth must RETURN to baseline
        # after having gone deeper, not simply start there.
        if i > scan_from and bd == baseline_bd and pd == baseline_pd:
            if lines[i].strip().endswith(';'):
                return i

    return None


# ── Entry point ───────────────────────────────────────────────────────────────

print()
print("=" * 51)
print("  R3 v4 \u2014 index.ts Billing Block Repair")
print("=" * 51)
print()

INDEX = ROOT / 'server' / 'index.ts'
if not INDEX.exists():
    fail("server/index.ts not found")
    sys.exit(1)

src   = read_file(INDEX)
lines = src.splitlines(keepends=True)

# ── 1. Find express.json({ ────────────────────────────────────────────────────
# Skip comment lines to avoid matching a comment like '// Uses express.json ...'
json_open_idx = None
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith('//') or stripped.startswith('*'):
        continue
    if re.search(r'express\.json\s*\(\s*\{', line):
        json_open_idx = i
        break

if json_open_idx is None:
    fail("Could not find express.json({ in server/index.ts")
    sys.exit(1)

info(f"express.json({{ at line {json_open_idx + 1}: {lines[json_open_idx].rstrip()}")

# ── 2. Check if repair is needed ──────────────────────────────────────────────
# A clean file has a property key (limit:/verify:/strict:) as the first
# non-blank content after express.json({. If so, nothing to do.
already_fixed = False
for i in range(json_open_idx + 1, min(json_open_idx + 8, len(lines))):
    stripped = lines[i].strip()
    if not stripped:
        continue           # skip blank lines
    if re.match(r'(limit|verify|strict)\s*:', stripped):
        already_fixed = True
    break                  # check only the first non-blank line

if already_fixed:
    ok("server/index.ts already correctly structured — no repair needed")
    print()
    print("=" * 51)
    print("  Run:  npx tsc --noEmit")
    print("=" * 51)
    print()
    sys.exit(0)

# ── 3. Find billing block start ───────────────────────────────────────────────
# Detect by a billing/stripe comment above the if-block, or the if(stripe)
# statement itself. Stop if we hit a property key first (no billing block here).
billing_start = None
for i in range(json_open_idx + 1, len(lines)):
    stripped = lines[i].strip()
    if stripped.startswith('//') and (
        'billing' in stripped.lower() or 'stripe' in stripped.lower()
    ):
        billing_start = i
        break
    if re.match(r'if\s*\(\s*stripe\b', stripped, re.IGNORECASE):
        billing_start = i
        break
    if re.match(r'(limit|verify|strict)\s*:', stripped):
        break   # property key found — billing block is not in this gap

if billing_start is None:
    fail("Billing block not found between express.json({ and its properties.")
    info("Inspect server/index.ts around express.json({ manually.")
    sys.exit(1)

info(f"Billing block starts at line {billing_start + 1}: {lines[billing_start].rstrip()}")

# ── 4. Find billing block end ─────────────────────────────────────────────────
# Count braces from billing_start; stop when depth returns to 0 after finding
# at least one open brace. The block is guaranteed balanced (was valid TS).
depth = 0
found_open = False
billing_end = None
for i in range(billing_start, len(lines)):
    for ch in lines[i]:
        if ch == '{': depth += 1; found_open = True
        elif ch == '}': depth -= 1
    if found_open and depth == 0:
        billing_end = i
        break

if billing_end is None:
    fail("Could not find end of billing block — unbalanced braces")
    sys.exit(1)

info(f"Billing block ends   at line {billing_end + 1}: {lines[billing_end].rstrip()}")

# Include any blank line immediately before the billing block — it lives
# inside express.json({ and should travel with the billing block.
block_start = billing_start
if block_start > 0 and lines[block_start - 1].strip() == '':
    block_start -= 1

billing_block = lines[block_start : billing_end + 1]
info(f"Billing block is {len(billing_block)} line(s) (lines {block_start+1}\u2013{billing_end+1})")

# Ensure exactly one blank line before the billing block in its new position.
if billing_block and billing_block[0].strip() != '':
    billing_block = ['\n'] + billing_block

# ── 5. Find app.use(express.json(...)) closing ); ────────────────────────────
closing_idx = find_appuse_close(lines, json_open_idx)
if closing_idx is None:
    fail("Could not find closing ); of app.use(express.json(...))")
    info("Inspect lines around express.json({ manually.")
    sys.exit(1)

info(f"app.use() closes     at line {closing_idx + 1}: {lines[closing_idx].rstrip()}")

# ── 6. Rebuild ────────────────────────────────────────────────────────────────
#
#   before_billing  = lines before the blank/billing section (unchanged)
#   props_and_close = limit:/verify:/}),/); — the content that belongs
#                     inside express.json and its two closing delimiters
#   billing_block   = the extracted block (with its leading blank line)
#   after_close     = rest of file after app.use closing );
#
before_billing  = lines[:block_start]
props_and_close = lines[billing_end + 1 : closing_idx + 1]
after_close     = lines[closing_idx + 1:]

new_lines = before_billing + props_and_close + billing_block + after_close
new_src   = ''.join(new_lines)

# ── 7. Sanity checks (directive §4: every failure surface must be handled) ────
checks_passed = True

# Check 1: express.json call still present
if not re.search(r'express\.json\s*\(', new_src):
    fail("Sanity: express.json call missing after rebuild")
    checks_passed = False

# Check 2: billing route still present
if '/billing/checkout' not in new_src:
    fail("Sanity: billing route missing after rebuild")
    checks_passed = False

# Check 3: first non-blank content after express.json({ is a property key,
# confirming the billing block is no longer between the brace and its properties.
json_open_m = re.search(r'express\.json\s*\(\s*\{', new_src)
if json_open_m:
    rest = new_src[json_open_m.end():]
    first_nonblank = re.search(r'\S', rest)
    if first_nonblank:
        snippet = rest[first_nonblank.start():first_nonblank.start() + 30]
        if not re.match(r'(limit|verify|strict)\s*:', snippet):
            fail(f"Sanity: first content after express.json({{ is not a property key: {snippet.strip()[:40]!r}")
            checks_passed = False
    else:
        fail("Sanity: express.json({ has no content after it")
        checks_passed = False
else:
    fail("Sanity: express.json pattern not found in rebuilt source")
    checks_passed = False

# Check 4: billing block comes AFTER the express.json call by file position.
# Use re.finditer to skip any commented occurrences of express.json.
json_call_pos = None
for m in re.finditer(r'express\.json\s*\(', new_src):
    line_start = new_src.rfind('\n', 0, m.start()) + 1
    if '//' not in new_src[line_start:m.start()]:
        json_call_pos = m.start()
        break

billing_pos = new_src.find('/billing/checkout')
if json_call_pos is not None and billing_pos != -1:
    if billing_pos < json_call_pos:
        fail("Sanity: billing block appears before express.json call")
        checks_passed = False

# Check 5: token counts unchanged — detect any accidentally dropped content.
for token in ('express.json', '/billing/checkout', 'app.use'):
    orig  = src.count(token)
    after = new_src.count(token)
    if orig != after:
        fail(f"Sanity: '{token}' count changed {orig} -> {after}")
        checks_passed = False

if not checks_passed:
    fail("Sanity checks failed — file NOT written. No changes made.")
    sys.exit(1)

# ── 8. Write ──────────────────────────────────────────────────────────────────
write_file(INDEX, new_src)   # error handling in write_file — no raw traceback

print()
ok("Rebuilt server/index.ts")
ok("Billing block relocated to after app.use(express.json(...))")
ok("All sanity checks passed")
print()

# Show the repaired region for visual confirmation
rebuilt = new_src.splitlines()
json_line_new = next(
    (i for i, l in enumerate(rebuilt)
     if re.search(r'express\.json', l) and not l.strip().startswith('//')),
    0,
)
start_show = max(0, json_line_new - 1)
end_show   = min(len(rebuilt), json_line_new + 22)
info("Repaired section:")
for i in range(start_show, end_show):
    info(f"  {i+1:4d}: {rebuilt[i]}")

print()
print("=" * 51)
print("  Run:  npx tsc --noEmit")
print("=" * 51)
print()