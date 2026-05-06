#!/usr/bin/env python3
"""
r3-fix-remaining.py
Fixes all remaining ❌ items from r3-enhance-patches.sh output.
Run from the project root: python3 r3-fix-remaining.py

Fixes applied:
  1. server/index.ts      — move /billing/checkout block after express.json(); add requireUser
  2. server/routes/loops.ts — add loopStationLimiter to GET / and GET /:id
  3. client/src/utils/projectSerializer.ts — wrap link.click() in try/finally
  4. shared/types/         — delete conflicting type files if no live imports found
"""

import re
import sys
import os
import subprocess
from pathlib import Path
from textwrap import indent

# ── Colour helpers ────────────────────────────────────────────────────────────
RED   = '\033[0;31m'
GRN   = '\033[0;32m'
YLW   = '\033[1;33m'
RESET = '\033[0m'

def ok(msg):   print(f"  {GRN}✅{RESET} {msg}")
def warn(msg): print(f"  {YLW}⚠ {RESET} {msg}")
def fail(msg): print(f"  {RED}❌{RESET} {msg}")
def info(msg): print(f"     {msg}")

def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')

def write(path: Path, content: str):
    path.write_text(content, encoding='utf-8')
    ok(f"Written: {path}")

ROOT = Path(__file__).parent.resolve()
os.chdir(ROOT)

print()
print("═══════════════════════════════════════════════════")
print("  R3 v4 — Remaining Fix Pass")
print("═══════════════════════════════════════════════════")


# ══════════════════════════════════════════════════════════════════════════════
# FIX 1: server/index.ts — billing route before express.json() + no auth
# Strategy:
#   a) Locate the billing block. It may be wrapped in `if (stripe) { ... }`
#      or be a bare app.post(). Walk braces to find complete block extent.
#   b) Remove it from current position.
#   c) Locate express.json() call; insert block immediately after that line.
#   d) Ensure requireUser is imported and added to the route handler.
# ══════════════════════════════════════════════════════════════════════════════
print()
print("[1/4] server/index.ts — billing route order + auth")

INDEX = ROOT / 'server' / 'index.ts'
if not INDEX.exists():
    warn("server/index.ts not found — skipping")
else:
    src = read(INDEX)
    lines = src.splitlines(keepends=True)

    # ── Find billing line ──────────────────────────────────────────────────────
    billing_idx = next(
        (i for i, l in enumerate(lines) if '/billing/checkout' in l), None
    )
    json_idx = next(
        (i for i, l in enumerate(lines) if 'express.json(' in l), None
    )

    if billing_idx is None:
        warn("'/billing/checkout' not found — already moved or different pattern")
    elif json_idx is None:
        warn("'express.json(' not found — inspect server/index.ts manually")
    elif billing_idx > json_idx:
        ok("Billing route already after express.json() — skipping move")
    else:
        # ── Walk back to find block start ──────────────────────────────────────
        # The block may be `if (stripe) {` (1 line above) or just `app.post(`.
        # Walk back up to 5 lines to find a line that starts a containing block.
        block_start = billing_idx
        for back in range(1, 6):
            candidate = billing_idx - back
            if candidate < 0:
                break
            stripped = lines[candidate].strip()
            # if (stripe), if (process.env.STRIPE...), or similar containing conditional
            if stripped.startswith('if ') and stripped.endswith('{'):
                block_start = candidate
                break
            # blank line means no containing block — stop
            if stripped == '':
                break

        # ── Walk forward to find block end (brace balance) ────────────────────
        depth = 0
        block_end = block_start
        found_open = False
        for i in range(block_start, len(lines)):
            for ch in lines[i]:
                if ch == '{':
                    depth += 1
                    found_open = True
                elif ch == '}':
                    depth -= 1
            if found_open and depth == 0:
                block_end = i
                break

        # Extract block lines (inclusive)
        block_lines = lines[block_start : block_end + 1]
        block_text = ''.join(block_lines)

        # ── Add requireUser to the route if not already present ───────────────
        if 'requireUser' not in block_text:
            # Pattern: app.post('/billing/checkout', async ...
            # Insert requireUser as a second middleware argument
            block_text = re.sub(
                r"app\.post\(['\"]\/billing\/checkout['\"],\s*",
                "app.post('/billing/checkout', requireUser, ",
                block_text,
            )
            info("Added requireUser to /billing/checkout handler")

        # Ensure requireUser import exists
        if 'requireUser' not in src:
            # Add import after last existing import from middleware/auth or near top imports
            auth_import = "import { requireUser } from './middleware/auth';"
            # Find a good insertion point — after the last ^import line
            last_import_idx = max(
                (i for i, l in enumerate(lines) if l.startswith('import ')),
                default=0,
            )
            lines.insert(last_import_idx + 1, auth_import + '\n')
            # Recompute indices after insertion
            billing_idx += 1
            json_idx += 1
            block_start += 1
            block_end += 1
            info("Added import { requireUser } from './middleware/auth'")

        # ── Rebuild: remove block, reinsert after express.json() ─────────────
        # Remove the block from its original position
        del lines[block_start : block_end + 1]

        # Recompute json_idx after deletion
        json_idx_new = next(
            (i for i, l in enumerate(lines) if 'express.json(' in l), None
        )
        if json_idx_new is None:
            fail("Lost express.json() line after deletion — aborting index.ts fix")
        else:
            # Insert block after the express.json() line, with a blank separator
            insert_at = json_idx_new + 1
            # Ensure there's a blank line before the block
            separator = ['\n'] if lines[insert_at - 1].strip() != '' else []
            for offset, line in enumerate(separator + ['// Billing route — must be after body-parsing middleware\n'] + [block_text]):
                lines.insert(insert_at + offset, line if isinstance(line, str) else line)

            write(INDEX, ''.join(lines))
            ok(f"Moved billing block from line {billing_idx+1} to after express.json() (line {json_idx_new+1})")


# ══════════════════════════════════════════════════════════════════════════════
# FIX 2: server/routes/loops.ts — add loopStationLimiter to GET routes
# Strategy:
#   a) Check if loopStationLimiter is already imported; find its source if so.
#   b) If not imported, locate the rate-limiter import pattern in the file and
#      derive the correct import. Fall back to express-rate-limit directly.
#   c) Inject into router.get('/', ...) and router.get('/:id', ...).
# ══════════════════════════════════════════════════════════════════════════════
print()
print("[2/4] server/routes/loops.ts — GET route rate limiting")

LOOPS = ROOT / 'server' / 'routes' / 'loops.ts'
if not LOOPS.exists():
    warn("server/routes/loops.ts not found — skipping")
else:
    src = read(LOOPS)

    if 'loopStationLimiter' in src:
        ok("loopStationLimiter already present — skipping")
    else:
        # ── Find where rate limiters are defined in this codebase ──────────────
        # Check server/middleware/ for a file that exports loopStationLimiter
        middleware_dir = ROOT / 'server' / 'middleware'
        limiter_file: Path | None = None
        for f in middleware_dir.glob('*.ts'):
            if 'loopStationLimiter' in f.read_text(encoding='utf-8'):
                limiter_file = f
                break

        if limiter_file:
            # Compute relative import path from routes/ to middleware/
            rel = os.path.relpath(limiter_file.with_suffix(''), LOOPS.parent)
            rel = rel.replace('\\', '/')
            if not rel.startswith('.'):
                rel = './' + rel
            limiter_import = f"import {{ loopStationLimiter }} from '{rel}';"
        else:
            # loopStationLimiter not found anywhere — check if there's any rateLimit import
            # and note the gap; use a defensive stub pointing to common location
            limiter_import = "import { loopStationLimiter } from '../middleware/rateLimiter';"
            warn("loopStationLimiter not found in server/middleware/ — import path may need adjustment")
            info(f"Generated import: {limiter_import}")

        # ── Inject import ──────────────────────────────────────────────────────
        lines = src.splitlines(keepends=True)
        last_import_idx = max(
            (i for i, l in enumerate(lines) if l.startswith('import ')),
            default=0,
        )
        lines.insert(last_import_idx + 1, limiter_import + '\n')
        src = ''.join(lines)

        # ── Inject limiter into GET routes ────────────────────────────────────
        # Pattern: router.get('/', handler)  →  router.get('/', loopStationLimiter, handler)
        # Pattern: router.get('/:id', handler)  →  router.get('/:id', loopStationLimiter, handler)
        #
        # Must handle both arrow functions and named function references.
        # The key constraint: insert loopStationLimiter between the path and the handler,
        # but ONLY on the exact GET '/' and GET '/:id' routes (not POST, not other paths).

        def inject_limiter(match: re.Match) -> str:
            """Insert loopStationLimiter after the path argument."""
            full = match.group(0)
            # Already has limiter — idempotent
            if 'loopStationLimiter' in full:
                return full
            path_end = match.end('path')
            # Find the comma after the path in the full match string
            comma_pos = full.index(',', match.start('path') - match.start())
            return full[:comma_pos] + ', loopStationLimiter' + full[comma_pos:]

        # Match router.get('/') and router.get('/:id') — not other paths
        src = re.sub(
            r"router\.get\((?P<path>'/'|\"\/\"),",
            lambda m: f"router.get({m.group('path')}, loopStationLimiter,",
            src,
        )
        src = re.sub(
            r"router\.get\((?P<path>'/:id'|\"/:id\"),",
            lambda m: f"router.get({m.group('path')}, loopStationLimiter,",
            src,
        )

        write(LOOPS, src)
        ok("Added loopStationLimiter to GET / and GET /:id")


# ══════════════════════════════════════════════════════════════════════════════
# FIX 3: client/src/utils/projectSerializer.ts — try/finally around link.click()
# Strategy:
#   a) Find the line containing link.click().
#   b) Find the URL.revokeObjectURL(url) call — it may be on the same or next line.
#   c) Remove the bare revokeObjectURL call.
#   d) Wrap link.click() in try { } finally { URL.revokeObjectURL(url); }.
#   e) Preserve original indentation.
# ══════════════════════════════════════════════════════════════════════════════
print()
print("[3/4] client/src/utils/projectSerializer.ts — try/finally URL leak")

SERIALIZER = ROOT / 'client' / 'src' / 'utils' / 'projectSerializer.ts'
if not SERIALIZER.exists():
    warn("client/src/utils/projectSerializer.ts not found — skipping")
else:
    src = read(SERIALIZER)

    if 'finally' in src and 'revokeObjectURL' in src:
        ok("finally block already present — skipping")
    elif 'link.click()' not in src:
        warn("link.click() pattern not found — inspect file manually")
    else:
        lines = src.splitlines(keepends=True)

        click_idx = next(
            (i for i, l in enumerate(lines) if 'link.click()' in l), None
        )
        revoke_idx = next(
            (i for i, l in enumerate(lines) if 'revokeObjectURL' in l), None
        )

        if click_idx is None:
            warn("link.click() index not found — skipping")
        else:
            # Detect indentation of the click line
            click_line = lines[click_idx]
            base_indent = len(click_line) - len(click_line.lstrip())
            pad = ' ' * base_indent

            # Extract the URL variable name from revokeObjectURL call
            url_var = 'url'  # sensible default
            if revoke_idx is not None:
                m = re.search(r'revokeObjectURL\((\w+)\)', lines[revoke_idx])
                if m:
                    url_var = m.group(1)

            # Build the replacement block
            new_block = (
                f"{pad}try {{\n"
                f"{pad}  link.click();\n"
                f"{pad}}} finally {{\n"
                f"{pad}  URL.revokeObjectURL({url_var});\n"
                f"{pad}}}\n"
            )

            # Remove bare revokeObjectURL line if it exists and is separate from click
            if revoke_idx is not None and revoke_idx != click_idx:
                # Remove revoke line first (adjust index if it comes after click)
                if revoke_idx > click_idx:
                    del lines[revoke_idx]
                    # click_idx unchanged
                else:
                    del lines[revoke_idx]
                    click_idx -= 1

            # Replace the click line with the try/finally block
            lines[click_idx] = new_block

            write(SERIALIZER, ''.join(lines))
            ok(f"Wrapped link.click() in try/finally with URL.revokeObjectURL({url_var})")


# ══════════════════════════════════════════════════════════════════════════════
# FIX 4: shared/types/ — delete conflicting type files if no live imports
# Strategy:
#   a) For each conflict file, grep the entire project (excluding node_modules,
#      dist, coverage) for any import referencing that file's base name.
#   b) If zero hits: delete the file and report.
#   c) If hits found: list them and skip deletion — manual decision required.
# ══════════════════════════════════════════════════════════════════════════════
print()
print("[4/4] shared/types/ — conflicting type file cleanup")

CONFLICT_FILES = [
    ROOT / 'shared' / 'types' / 'audio.types.ts',
    ROOT / 'shared' / 'types' / 'automation.types.ts',
    ROOT / 'shared' / 'types' / 'meter.types.ts',
]

EXCLUDE_DIRS = ['node_modules', 'dist', 'coverage', '.git', 'build']

def find_imports(base_name: str) -> list[str]:
    """Return list of files that import base_name (without extension)."""
    hits = []
    for ext in ('*.ts', '*.tsx'):
        result = subprocess.run(
            ['grep', '-rl', base_name, '--include', ext, str(ROOT)],
            capture_output=True, text=True
        )
        for line in result.stdout.splitlines():
            p = Path(line)
            # Exclude unwanted directories
            parts = p.parts
            if any(ex in parts for ex in EXCLUDE_DIRS):
                continue
            # Exclude the conflict file itself
            if p in CONFLICT_FILES:
                continue
            hits.append(str(p.relative_to(ROOT)))
    return list(set(hits))

any_conflict = False
for cf in CONFLICT_FILES:
    if not cf.exists():
        continue
    any_conflict = True
    base = cf.stem  # e.g. "audio.types"
    hits = find_imports(base)

    if not hits:
        cf.unlink()
        ok(f"Deleted {cf.relative_to(ROOT)} — zero live imports found")
    else:
        fail(f"{cf.relative_to(ROOT)} — {len(hits)} live import(s) found; cannot auto-delete")
        for h in hits:
            info(f"  → {h}")
        info("Update those imports to the canonical top-level shared/*.types.ts then re-run.")

if not any_conflict:
    ok("No conflicting type files found")


# ── Summary ───────────────────────────────────────────────────────────────────
print()
print("═══════════════════════════════════════════════════")
print("  Fix pass complete.")
print("  Re-run r3-enhance-patches.sh to verify all ✅.")
print("═══════════════════════════════════════════════════")
print()
