#!/usr/bin/env python3
"""
r3-install-audit.py  —  R3 v4 Session Audit Installer
───────────────────────────────────────────────────────
Deploys r3-audit-session.ts into scripts/ and wires it into package.json.

Must be placed in the project root alongside r3-audit-session.ts, then run:

    python3 r3-install-audit.py           # install + wire
    python3 r3-install-audit.py --dry-run # show what would change, no writes
    python3 r3-install-audit.py --unwire  # remove the pnpm script entry only

What it does (in order — no writes before all reads complete):
  Phase 1  Read   r3-audit-session.ts (source), scripts/ (destination state),
                  package.json, server/tsconfig.json — hard stop if any unreadable
  Phase 2  Check  idempotency — skip phases that are already applied
  Phase 3  Backup scripts/r3-audit-session.ts if it exists
  Phase 4  Copy   r3-audit-session.ts → scripts/r3-audit-session.ts
  Phase 5  Verify written content matches source byte-for-byte
  Phase 6  Wire   "audit:session" script into package.json
  Phase 7  Verify server/tsconfig.json includes server/types/ (for express.d.ts)
  Phase 8  Print  complete run instructions

Exit codes:
  0  — success
  1  — hard error (file unreadable, write failed, verification mismatch)
  2  — dry-run (would succeed — changes printed but not applied)
"""

import sys
import os
import json
import shutil
import re
import subprocess
from pathlib import Path
from datetime import datetime

# ── Constants ──────────────────────────────────────────────────────────────────
ARGV     = sys.argv[1:]
DRY_RUN  = '--dry-run' in ARGV
UNWIRE   = '--unwire'  in ARGV

ROOT     = Path(__file__).parent.resolve()
SRC_NAME = 'r3-audit-session.ts'
SRC_PATH = ROOT / SRC_NAME
DST_REL  = 'scripts/r3-audit-session.ts'
DST_PATH = ROOT / DST_REL

BACKUP_DIR   = ROOT / '.r3-backups' / datetime.now().strftime('%Y%m%d_%H%M%S')
PNPM_SCRIPT_KEY = 'audit:session'
PNPM_SCRIPT_VAL = 'pnpm tsx scripts/r3-audit-session.ts'

# Colours
GRN  = '\033[0;32m'; RED  = '\033[0;31m'; YLW  = '\033[1;33m'
BLU  = '\033[0;34m'; DIM  = '\033[2m';    RST  = '\033[0m'
BOLD = '\033[1m'
HR   = '\u2500'  # box-drawing horizontal bar (used in section headers)

def ok(m):      print(f"  {GRN}\u2705{RST} {m}")
def fail(m):    print(f"  {RED}\u274c{RST} {m}"); sys.exit(1)
def warn(m):    print(f"  {YLW}\u26a0 {RST} {m}")
def info(m):    print(f"     {DIM}{m}{RST}")
def dry(m):     print(f"  {BLU}\u21b3 DRY{RST} {m}")
def section(t): print(f"\n{BOLD}{BLU}\u2500\u2500 {t} {HR*max(0,52-len(t))}{RST}")
def hdr(t):     print(f"\n{BOLD}{'='*56}{RST}"); print(f"  {BOLD}{t}{RST}"); print(f"{BOLD}{'='*56}{RST}")


def read(p: Path) -> str:
    """Read file — hard-stop on any error (prime directive)."""
    try:
        return p.read_text(encoding='utf-8')
    except OSError as e:
        fail(f"HARD STOP: cannot read {p}: {e}")
    return ""  # unreachable — fail() exits


def write_safe(p: Path, content: str) -> None:
    """Write content to p — hard-stop on failure."""
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding='utf-8')
    except OSError as e:
        fail(f"HARD STOP: cannot write {p}: {e}")


def backup(p: Path) -> Path:
    """Copy p to BACKUP_DIR preserving relative structure."""
    rel  = p.relative_to(ROOT)
    dest = BACKUP_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)
    return dest


# ── Help ───────────────────────────────────────────────────────────────────────
if '--help' in ARGV:
    print(__doc__)
    sys.exit(0)

os.chdir(ROOT)

hdr("R3 v4  \u2014  Session Audit Installer")
print(f"  Root:    {ROOT}")
print(f"  Mode:    {f'{YLW}DRY-RUN (no writes){RST}' if DRY_RUN else f'{GRN}INSTALL{RST}'}")
if UNWIRE:
    print(f"  Action:  {YLW}--unwire (remove pnpm script only){RST}")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1: READ EVERYTHING  —  hard stop if any required file is unreadable
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 1: Reading all files")

# 1a. Source audit file — must exist next to this installer
if not SRC_PATH.exists():
    fail(
        f"Source file not found: {SRC_NAME}\n"
        f"     Place r3-audit-session.ts in the same directory as this installer\n"
        f"     (project root: {ROOT}), then re-run."
    )
src_content = read(SRC_PATH)
info(f"Source:       {SRC_NAME}  ({len(src_content.splitlines())} lines)")

# 1b. Destination (may or may not exist)
dst_exists      = DST_PATH.exists()
dst_content_old = read(DST_PATH) if dst_exists else None
if dst_exists:
    info(f"Destination:  {DST_REL}  ({len(dst_content_old.splitlines())} lines — will be replaced)")
else:
    info(f"Destination:  {DST_REL}  (new file)")

# 1c. package.json — must exist
PKG_PATH = ROOT / 'package.json'
if not PKG_PATH.exists():
    fail("package.json not found at project root.")
pkg_raw = read(PKG_PATH)
try:
    pkg = json.loads(pkg_raw)
except json.JSONDecodeError as e:
    fail(f"package.json is not valid JSON: {e}")
info(f"package.json: read  ({len(pkg_raw.splitlines())} lines)")

# 1d. server/tsconfig.json — needed for Phase 7
TSCONFIG_PATH = ROOT / 'server' / 'tsconfig.json'
tsconfig_raw  = read(TSCONFIG_PATH) if TSCONFIG_PATH.exists() else None
if tsconfig_raw is None:
    warn("server/tsconfig.json not found — will skip tsconfig scope check")
    info("(This is required for server/types/express.d.ts to be visible project-wide)")
else:
    info(f"server/tsconfig.json: read")

ok("All reachable files read")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2: IDEMPOTENCY CHECK
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 2: Idempotency check")

audit_already_installed   = dst_exists and dst_content_old == src_content
pnpm_script_already_wired = (
    pkg.get('scripts', {}).get(PNPM_SCRIPT_KEY) == PNPM_SCRIPT_VAL
)

if audit_already_installed and pnpm_script_already_wired and not UNWIRE:
    ok("Already fully installed — nothing to do")
    print()
    print(f"  {BLU}Run:{RST}  pnpm run audit:session")
    print(f"  {BLU}Or: {RST}  pnpm tsx scripts/r3-audit-session.ts --help")
    sys.exit(0)

if audit_already_installed:
    ok(f"scripts/r3-audit-session.ts already up to date — skipping copy")
else:
    info("scripts/r3-audit-session.ts needs update")

if pnpm_script_already_wired:
    ok(f'package.json already has "{PNPM_SCRIPT_KEY}" script — skipping wire')
else:
    info(f'package.json needs "{PNPM_SCRIPT_KEY}" entry')


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3: BACKUP
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 3: Backup")

if DRY_RUN:
    dry("Would backup to: " + str(BACKUP_DIR.relative_to(ROOT)))
    if dst_exists and not audit_already_installed:
        dry(f"Would backup: {DST_REL}")
    if not pnpm_script_already_wired:
        dry("Would backup: package.json")
else:
    backed_up = False
    if dst_exists and not audit_already_installed:
        bpath = backup(DST_PATH)
        info(f"Backed up:    {DST_REL} → {bpath.relative_to(ROOT)}")
        backed_up = True
    if not pnpm_script_already_wired:
        bpath = backup(PKG_PATH)
        info(f"Backed up:    package.json → {bpath.relative_to(ROOT)}")
        backed_up = True
    if backed_up:
        ok(f"Backups written to {BACKUP_DIR.relative_to(ROOT)}")
    else:
        ok("Nothing needed backing up")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4: COPY AUDIT FILE
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 4: Installing scripts/r3-audit-session.ts")

if audit_already_installed:
    ok("Already installed — skipping")
elif DRY_RUN:
    dry(f"{SRC_NAME} → {DST_REL}")
else:
    write_safe(DST_PATH, src_content)
    ok(f"Installed: {DST_REL}")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5: VERIFY
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 5: Verifying installation")

if DRY_RUN or audit_already_installed:
    info("Skipped (dry-run or already installed)")
else:
    written = read(DST_PATH)
    if written != src_content:
        fail(
            f"Verification failed: {DST_REL} content does not match source.\n"
            f"     Expected {len(src_content)} chars, got {len(written)} chars.\n"
            f"     Original backed up to {BACKUP_DIR.relative_to(ROOT)}"
        )
    ok(f"Verified: {DST_REL}  ({len(written.splitlines())} lines, byte-identical to source)")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6: WIRE INTO package.json
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 6: Wiring into package.json")

if UNWIRE:
    # Remove the script entry
    scripts = pkg.setdefault('scripts', {})
    if PNPM_SCRIPT_KEY not in scripts:
        warn(f'"{PNPM_SCRIPT_KEY}" not found in package.json scripts — nothing to remove')
    elif DRY_RUN:
        dry(f'Would remove "scripts.{PNPM_SCRIPT_KEY}" from package.json')
    else:
        del scripts[PNPM_SCRIPT_KEY]
        # Re-serialise preserving 2-space indent
        new_pkg = json.dumps(pkg, indent=2, ensure_ascii=False) + '\n'
        write_safe(PKG_PATH, new_pkg)
        ok(f'Removed "scripts.{PNPM_SCRIPT_KEY}" from package.json')
    sys.exit(0)

if pnpm_script_already_wired:
    ok("Already wired — skipping")
else:
    # Insert into the scripts block.
    # Strategy: parse JSON, add the key, re-serialise with 2-space indent.
    # Preserve the existing key order (Python 3.7+ dicts are insertion-ordered).
    scripts = pkg.setdefault('scripts', {})

    # Position: insert after any existing "audit" or "audit:*" key for grouping.
    # If none exist, append at end of scripts block.
    ordered: dict[str, str] = {}
    inserted = False
    for k, v in scripts.items():
        ordered[k] = v
        # Insert after the last key that starts with 'audit'
        if k.startswith('audit'):
            ordered[PNPM_SCRIPT_KEY] = PNPM_SCRIPT_VAL
            inserted = True
    if not inserted:
        ordered[PNPM_SCRIPT_KEY] = PNPM_SCRIPT_VAL

    pkg['scripts'] = ordered
    new_pkg_str = json.dumps(pkg, indent=2, ensure_ascii=False) + '\n'

    if DRY_RUN:
        dry(f'Would add to package.json scripts:')
        dry(f'  "{PNPM_SCRIPT_KEY}": "{PNPM_SCRIPT_VAL}"')
    else:
        write_safe(PKG_PATH, new_pkg_str)

        # Verify the round-trip
        verify_pkg = json.loads(read(PKG_PATH))
        if verify_pkg.get('scripts', {}).get(PNPM_SCRIPT_KEY) != PNPM_SCRIPT_VAL:
            fail(f'Verification failed: "{PNPM_SCRIPT_KEY}" not found in written package.json')

        ok(f'Added to package.json:  "scripts.{PNPM_SCRIPT_KEY}": "{PNPM_SCRIPT_VAL}"')


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7: VERIFY server/tsconfig.json INCLUDES server/types/
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 7: Verify server/tsconfig.json scope")

if tsconfig_raw is None:
    warn("server/tsconfig.json not found — skipping scope check")
    warn("Without it, server/types/express.d.ts may not be visible to the compiler")
    warn("Ensure the tsconfig that compiles server/ includes 'types/**/*' or '**/*'")
else:
    # Parse as JSON (tsconfig may have comments — strip them first with a simple pass)
    tsconfig_no_comments = re.sub(r'//[^\n]*', '', tsconfig_raw)
    tsconfig_no_comments = re.sub(r'/\*.*?\*/', '', tsconfig_no_comments, flags=re.DOTALL)
    try:
        tsconfig = json.loads(tsconfig_no_comments)
    except json.JSONDecodeError:
        warn("Could not parse server/tsconfig.json as JSON — manual check required")
        tsconfig = {}

    include = tsconfig.get('compilerOptions', {})  # not used directly
    include_list = tsconfig.get('include', None)

    # Three valid states:
    #   A. No include → TS scans all files → types/ is covered automatically
    #   B. include contains "**/*" or similar wildcard
    #   C. include explicitly lists types/ or types/**/*
    covered = False
    coverage_note = ""

    if include_list is None:
        covered = True
        coverage_note = "no `include` field — TypeScript scans all server/ files (types/ included)"
    else:
        for entry in include_list:
            if entry in ("**/*", "**/*.ts", "**/*.d.ts"):
                covered = True
                coverage_note = f'`include` contains "{entry}" — types/ is covered'
                break
            if "types" in entry:
                covered = True
                coverage_note = f'`include` contains "{entry}" — types/ explicitly covered'
                break

    if covered:
        ok(f"server/tsconfig.json — {coverage_note}")
    else:
        warn("server/tsconfig.json `include` may not cover server/types/")
        warn("server/types/express.d.ts (req.user augmentation) may be invisible to the compiler")
        info('Fix: ensure `include` in server/tsconfig.json contains "**/*" or "types/**/*"')
        info(f'Current include list: {json.dumps(include_list)}')

        if not DRY_RUN:
            # Offer a patch: add **/* to include if it's a simple list without wildcards
            safe_to_patch = (
                isinstance(include_list, list) and
                all(isinstance(x, str) for x in include_list) and
                not any('*' in x for x in include_list)
            )
            if safe_to_patch:
                # Add "**/*" so the types/ directory is covered
                new_include = include_list + ["**/*"]
                tsconfig['include'] = new_include
                # Re-serialise (without the comment stripping — preserve original comments)
                # Use a targeted replacement: find the "include": [...] block and append
                # Safer: just report the manual fix rather than blindly rewriting
                info('Manual fix required — add to server/tsconfig.json:')
                info('  "include": ["**/*"]')
                info('Or add "**/*" to the existing include array')
            else:
                info('Manual fix: add "**/*" to the include array in server/tsconfig.json')


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 8: RUN INSTRUCTIONS
# ══════════════════════════════════════════════════════════════════════════════
section("Phase 8: Complete")

if DRY_RUN:
    print()
    print(f"  {YLW}DRY-RUN complete — no files were changed.{RST}")
    print(f"  Re-run without --dry-run to apply.")
    sys.exit(2)

print()
print(f"  {GRN}{BOLD}Installation complete.{RST}")
print()
print(f"  {BOLD}Run the session audit:{RST}")
print(f"    pnpm run audit:session")
print()
print(f"  {BOLD}Or directly:{RST}")
print(f"    pnpm tsx scripts/r3-audit-session.ts")
print()
print(f"  {BOLD}Flags:{RST}")
print(f"    --fix       Apply safe auto-remediations (moves strays, runs r3-place-files.py)")
print(f"    --no-pass   Suppress PASS items (less noise, BLOCKs/WARNs only)")
print(f"    --json      Machine-readable output for CI pipelines")
print()
print(f"  {BOLD}Run alongside the project-wide audit:{RST}")
print(f"    pnpm tsx scripts/r3-audit-v4.ts && pnpm tsx scripts/r3-audit-session.ts")
print()
print(f"  {BOLD}CI one-liner (fails on any BLOCK):{RST}")
print(f"    pnpm tsx scripts/r3-audit-v4.ts --json && \\")
print(f"    pnpm tsx scripts/r3-audit-session.ts --json --no-pass")
print()
if (BACKUP_DIR / 'package.json').exists() or any(BACKUP_DIR.rglob('*')):
    print(f"  {DIM}Originals backed up to: {BACKUP_DIR.relative_to(ROOT)}{RST}")
print()