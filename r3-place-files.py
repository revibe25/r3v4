#!/usr/bin/env python3
"""
r3-place-files.py
Moves all enhanced files from the project root to their correct destinations.

Per the prime directive: reads every source and destination file before
writing anything. Backs up originals. Verifies all moves. Removes root
copies after successful placement.

Run from project root: python3 r3-place-files.py
"""

import sys
import os
import shutil
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).parent.resolve()
os.chdir(ROOT)

GRN = '\033[0;32m'; RED = '\033[0;31m'; YLW = '\033[1;33m'; BLU = '\033[0;34m'; RESET = '\033[0m'
def ok(m):      print(f"  {GRN}✅{RESET} {m}")
def fail(m):    print(f"  {RED}❌{RESET} {m}")
def warn(m):    print(f"  {YLW}⚠ {RESET} {m}")
def info(m):    print(f"     {m}")
def section(m): print(f"\n{BLU}── {m} {'─'*max(0,44-len(m))}{RESET}")

BACKUP_DIR = ROOT / '.r3-backups' / datetime.now().strftime('%Y%m%d_%H%M%S')


def read_file(p: Path) -> str | None:
    """Read file, return None (not hard-exit) so caller can decide."""
    try:
        return p.read_text(encoding='utf-8')
    except OSError:
        return None


def backup(p: Path) -> Path:
    """Copy p to BACKUP_DIR, preserving relative path. Returns backup path."""
    rel  = p.relative_to(ROOT)
    dest = BACKUP_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)
    return dest


# ── File move manifest ────────────────────────────────────────────────────────
# Each entry: (root_copy_name, correct_destination_relative)
#
# These are the files that were delivered as enhanced versions and were
# placed at the project root instead of their correct subdirectory paths.
MOVES = [
    # Server routes
    ('auth.ts',          'server/routes/auth.ts'),
    ('effects.ts',       'server/routes/effects.ts'),
    ('presets.ts',       'server/routes/presets.ts'),
    ('waveform.ts',      'server/routes/waveform.ts'),
    # Server middleware
    ('enforceUsage.ts',  'server/middleware/enforceUsage.ts'),
    # Client utils
    ('time.ts',          'client/src/utils/time.ts'),
    # Client visual
    ('oscilloscope.tsx', 'client/src/visual/oscilloscope.tsx'),
]

# ── New-file manifest ─────────────────────────────────────────────────────────
# Each entry: (destination_relative, file_content)
#
# These are brand-new files that do not exist in the project yet and have
# no root-level copy to move. Content is embedded here so this script is
# fully self-contained — no external file required.
INSTALLS: list[tuple[str, str]] = [
    (
        'server/types/express.d.ts',
        # ── Content start ──────────────────────────────────────────────────
        # Centralises the Express Request augmentation so every file in the
        # server compilation sees req.user without depending on auth.ts being
        # compiled first.
        #
        # Previously declared inline inside server/routes/auth.ts. TypeScript
        # only guarantees augmentations in .d.ts files are visible project-wide.
        # An augmentation in a regular .ts file is only active when that file is
        # in the current compilation unit — middleware files compiled separately
        # would see req.user as undefined or get a type error.
        #
        # Ensure server/tsconfig.json includes this directory:
        #   "include": ["**/*"]   — picks up all .ts/.d.ts under server/
        '''\
// server/types/express.d.ts
//
// Centralises the Express Request augmentation so every file in the server
// compilation sees req.user without depending on auth.ts being loaded first.
//
// Shape matches the JWT payload written at login/register in auth.ts:
//   jwt.sign({ userId: user.id, username: user.username }, ...)

declare namespace Express {
  interface Request {
    /**
     * Set by requireUser middleware after JWT verification.
     * Contains the claims written into the token at login/register.
     * Undefined on unauthenticated requests.
     */
    user?: {
      userId:   string;
      username: string;
    };
  }
}
''',
        # ── Content end ────────────────────────────────────────────────────
    ),
]


print()
print("=" * 51)
print("  R3 v4 — Enhanced File Placement Repair")
print("=" * 51)
print(f"\n  Backup directory: {BACKUP_DIR.relative_to(ROOT)}")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1: READ EVERYTHING — hard stop if anything is unreadable
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 1: Reading all files")

reads: dict[str, dict] = {}  # key = root_name
blocked = False

for root_name, dest_rel in MOVES:
    root_copy = ROOT / root_name
    dest_path = ROOT / dest_rel

    root_src  = read_file(root_copy)
    dest_src  = read_file(dest_path)

    if root_src is None:
        warn(f"{root_name} — not found at root (may already be placed or never delivered)")
    else:
        info(f"✓ {root_name}  ({len(root_src.splitlines())} lines at root)")

    if dest_src is None and root_src is not None:
        # Destination doesn't exist — this is unexpected (original should be there)
        warn(f"  destination {dest_rel} does not exist — will create it")
    elif dest_src is not None:
        info(f"  ✓ {dest_rel}  ({len(dest_src.splitlines())} lines at destination)")

    reads[root_name] = {
        'root_path':  root_copy,
        'dest_path':  dest_path,
        'root_src':   root_src,
        'dest_src':   dest_src,
        'dest_rel':   dest_rel,
    }

if blocked:
    fail("HARD STOP: Unreadable files above must be resolved before proceeding.")
    sys.exit(1)

ok("All reachable files read")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: VALIDATE — confirm each root copy is the enhanced version
# (longer than or different from the destination)
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 2: Validating enhanced content")

for root_name, data in reads.items():
    root_src = data['root_src']
    dest_src = data['dest_src']

    if root_src is None:
        warn(f"{root_name}: no root copy — skipping")
        continue

    if dest_src is None:
        info(f"{root_name}: destination is new — will install enhanced version")
        continue

    if root_src == dest_src:
        warn(f"{root_name}: root copy and destination are identical — already placed?")
        data['already_placed'] = True
    else:
        root_lines = len(root_src.splitlines())
        dest_lines = len(dest_src.splitlines())
        info(f"{root_name}: root={root_lines}L  dest={dest_lines}L  → will replace destination")
        data['already_placed'] = False

ok("Validation complete")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: BACKUP originals
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 3: Backing up originals")

BACKUP_DIR.mkdir(parents=True, exist_ok=True)
backed_up = 0

for root_name, data in reads.items():
    if data['root_src'] is None:
        continue
    if data.get('already_placed'):
        continue

    # Backup existing destination (the pre-enhancement original)
    if data['dest_src'] is not None:
        bpath = backup(data['dest_path'])
        info(f"Backed up: {data['dest_rel']} → {bpath.relative_to(ROOT)}")
        backed_up += 1

    # Also backup the root copy before we remove it
    bpath = backup(data['root_path'])
    info(f"Backed up: {root_name} → {bpath.relative_to(ROOT)}")

ok(f"{backed_up} original destination files backed up")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: MOVE files to correct destinations
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 4: Moving files to correct destinations")

moved   = 0
skipped = 0
errors  = []

for root_name, data in reads.items():
    root_src  = data['root_src']
    root_path = data['root_path']
    dest_path = data['dest_path']
    dest_rel  = data['dest_rel']

    if root_src is None:
        warn(f"{root_name}: no root copy — skipping")
        skipped += 1
        continue

    if data.get('already_placed'):
        warn(f"{root_name}: content identical to destination — removing root copy only")
        root_path.unlink()
        skipped += 1
        continue

    try:
        # Ensure destination directory exists
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        # Write enhanced content to correct destination
        dest_path.write_text(root_src, encoding='utf-8')
        # Remove root-level copy
        root_path.unlink()
        ok(f"{root_name} → {dest_rel}")
        moved += 1
    except OSError as e:
        fail(f"Failed to move {root_name}: {e}")
        errors.append(root_name)


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5: VERIFY — read each destination and confirm content matches
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 5: Verifying placements")

verify_errors = []

for root_name, data in reads.items():
    if data['root_src'] is None or data.get('already_placed'):
        continue
    if root_name in errors:
        continue

    dest_path = data['dest_path']
    written   = read_file(dest_path)

    if written is None:
        verify_errors.append(f"{data['dest_rel']}: unreadable after write")
        fail(f"Verification failed: {data['dest_rel']} is unreadable")
    elif written != data['root_src']:
        verify_errors.append(f"{data['dest_rel']}: content mismatch after write")
        fail(f"Verification failed: {data['dest_rel']} content mismatch")
    else:
        ok(f"Verified: {data['dest_rel']} ({len(written.splitlines())} lines)")

    # Confirm root copy is gone
    if data['root_path'].exists():
        warn(f"Root copy still exists: {root_name} — removing now")
        try:
            data['root_path'].unlink()
        except OSError as e:
            warn(f"Could not remove root copy {root_name}: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5b: INSTALL new files that have no root-level copy
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 5b: Installing new files")

installed   = 0
install_errs = []

for dest_rel, content in INSTALLS:
    dest_path = ROOT / dest_rel

    # Backup existing file if present (e.g. re-running after partial install)
    if dest_path.exists():
        existing = read_file(dest_path)
        if existing == content:
            ok(f"Already installed: {dest_rel}")
            continue
        bpath = backup(dest_path)
        info(f"Backed up existing: {dest_rel} → {bpath.relative_to(ROOT)}")

    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_text(content, encoding='utf-8')
        # Verify immediately
        written = read_file(dest_path)
        if written != content:
            install_errs.append(f"{dest_rel}: content mismatch after write")
            fail(f"Install verification failed: {dest_rel}")
        else:
            ok(f"Installed: {dest_rel} ({len(content.splitlines())} lines)")
            installed += 1
    except OSError as e:
        install_errs.append(f"{dest_rel}: {e}")
        fail(f"Failed to install {dest_rel}: {e}")

verify_errors.extend(install_errs)


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6: SCAN for any remaining root-level .ts/.tsx files that don't belong
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 6: Scanning for other misplaced TypeScript files")

# Files that legitimately live at the project root
LEGITIMATE_ROOT_TS = {
    'drizzle.config.ts',
    'implement-r3.ts',
    'index.ts',       # root entry point (legitimate)
    'turbo.json',     # not TS but keep in mind
    'vitest.config.ts',
    'eslint.config.mjs',
}

unexpected = []
for p in ROOT.glob('*.ts'):
    if p.name not in LEGITIMATE_ROOT_TS:
        unexpected.append(p)
for p in ROOT.glob('*.tsx'):
    unexpected.append(p)

if unexpected:
    warn(f"Found {len(unexpected)} unexpected TypeScript file(s) at project root:")
    for p in sorted(unexpected):
        info(f"  {p.name}")
    info("These may be additional misplaced enhanced files. Review manually.")
else:
    ok("No unexpected TypeScript files at project root")


# ── Summary ───────────────────────────────────────────────────────────────────
all_errors = errors + verify_errors
print()
print("=" * 51)
if not all_errors:
    print(f"  Complete. {moved} file(s) placed, {installed} installed, {skipped} skipped.")
    print()
    print("  Next steps:")
    print("  1. npx tsc --noEmit")
    print("  2. ./r3-enhance-patches.sh")
    print("  3. Check visual and waveform panels in the browser")
    print()
    print(f"  Originals backed up to: {BACKUP_DIR.relative_to(ROOT)}")
else:
    fail(f"{len(all_errors)} error(s) — manual intervention required:")
    for e in all_errors:
        info(f"  {e}")
print("=" * 51)
print()
