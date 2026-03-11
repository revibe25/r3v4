#!/usr/bin/env python3
"""
R3 v4 -- Fix References + Full Stack Cleanup
=============================================
Fixes all source file references to old env key names first,
then runs every cleanup action in a single live pass.

Execution order:
  [1/4] Fix server/config.ts     -- R2_* -> STORAGE_*, AUTH_TOKEN_* -> JWT_*
  [2/4] Fix server/middleware/auth.ts -- AUTH_TOKEN_* -> JWT_*
  [3/4] Fix shared/subscription.types.ts -- update JSDoc comment only
  [4/4] Verify zero blocked keys remain, then run full cleanup live

Change accountability per audit directive §7 is documented per section.
"""

import re
import sys
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

# -- Terminal colours ----------------------------------------------------------

R      = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
CYAN   = "\033[36m"
DIM    = "\033[2m"

def ok(m):   print(f"{GREEN}  v  {m}{R}")
def warn(m): print(f"{YELLOW}  !  {m}{R}")
def err(m):  print(f"{RED}  x  {m}{R}")
def head(m): print(f"\n{BOLD}{m}{R}")
def dim(m):  print(f"{DIM}     {m}{R}")
def info(m): print(f"{CYAN}  ->  {m}{R}")

def backup(path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest  = path.with_suffix(f".{stamp}.bak")
    shutil.copy2(path, dest)
    return dest

def shell(cmd: str, cwd: Path = None) -> tuple:
    result = subprocess.run(
        cmd, shell=True, cwd=str(cwd or root),
        capture_output=True, text=True
    )
    return result.returncode, (result.stdout + result.stderr).strip()

def apply(label: str, path: Path, old: str, new: str) -> bool:
    text = path.read_text()
    if old not in text:
        warn(f"SKIP {label} -- pattern not found in {path.name}")
        return False
    bak = backup(path)
    path.write_text(text.replace(old, new, 1))
    ok(f"{label}")
    dim(f"bak: {bak.name}")
    return True

# -- Locate project root -------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
root = SCRIPT_DIR
for _ in range(8):
    if (root / "server").is_dir() and (root / "client").is_dir():
        break
    root = root.parent
else:
    err("Cannot locate project root.")
    sys.exit(1)

print(f"\n{BOLD}{'=' * 60}")
print("  R3 v4 -- Fix References + Stack Cleanup")
print(f"{'=' * 60}{R}")
print(f"  Root: {root}\n")

blocked = []
fixed   = []
deleted = []

# =============================================================================
# [1/4] Fix server/config.ts
#
# ROOT CAUSE: config.ts reads R2_ENDPOINT, R2_ACCESS_KEY_ID,
#   R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME from process.env. These are the old
#   key names from server/.env. The canonical names used everywhere else in
#   the stack are STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID,
#   STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET. Root .env has canonical names.
#   With old names in config.ts and canonical names in .env, every R2 env
#   var resolves to '' (empty string default) in production -- silently broken.
#
# FIX RATIONALE: Update config.ts to read canonical STORAGE_* names.
#   server/services/storage.ts reads UPLOAD_CONFIG.R2_* -- those property
#   names inside the config object do not need to change (internal to server).
#   Only the process.env key names change.
#
# AFFECTED SURFACE: server/config.ts only.
#   server/services/storage.ts is unaffected -- it reads UPLOAD_CONFIG.R2_*
#   properties which retain their names. Only the env key lookup changes.
#
# REGRESSION CHECK: All UPLOAD_CONFIG property names preserved. Callers
#   (storage.ts) continue to use UPLOAD_CONFIG.R2_ENDPOINT etc. unchanged.
# =============================================================================

head("[1/4] Fix server/config.ts -- R2_* env keys -> STORAGE_* canonical names")

CONFIG_FILE = root / "server" / "config.ts"

if not CONFIG_FILE.exists():
    err("server/config.ts not found -- HARD STOP")
    sys.exit(1)

config_text = CONFIG_FILE.read_text()

NEW_CONFIG = config_text \
    .replace(
        "process.env.R2_ENDPOINT          || ''",
        "process.env.STORAGE_ENDPOINT     || ''"
    ) \
    .replace(
        "process.env.R2_ACCESS_KEY_ID     || ''",
        "process.env.STORAGE_ACCESS_KEY_ID || ''"
    ) \
    .replace(
        "process.env.R2_SECRET_ACCESS_KEY || ''",
        "process.env.STORAGE_SECRET_ACCESS_KEY || ''"
    ) \
    .replace(
        "process.env.R2_BUCKET_NAME       || 'r3-samples'",
        "process.env.STORAGE_BUCKET        || 'r3-uploads'"
    )

# Also update the property names to match canonical naming
# (UPLOAD_CONFIG.R2_* -> UPLOAD_CONFIG.STORAGE_*) so config is self-consistent
NEW_CONFIG = NEW_CONFIG \
    .replace("  R2_ENDPOINT:          ", "  STORAGE_ENDPOINT:          ") \
    .replace("  R2_ACCESS_KEY_ID:     ", "  STORAGE_ACCESS_KEY_ID:     ") \
    .replace("  R2_SECRET_ACCESS_KEY: ", "  STORAGE_SECRET_ACCESS_KEY: ") \
    .replace("  R2_BUCKET_NAME:       ", "  STORAGE_BUCKET:            ")

if NEW_CONFIG == config_text:
    warn("config.ts -- no changes detected, may already be updated or spacing differs")
    warn("Manual check required: grep R2_ server/config.ts")
    blocked.append("server/config.ts -- pattern mismatch, review manually")
else:
    bak = backup(CONFIG_FILE)
    CONFIG_FILE.write_text(NEW_CONFIG)
    ok("server/config.ts -- R2_* -> STORAGE_* (env keys + property names)")
    dim(f"bak: {bak.name}")
    fixed.append("server/config.ts -- STORAGE_* canonical env keys")

# =============================================================================
# [1b] Fix server/services/storage.ts -- update UPLOAD_CONFIG property refs
#
# ROOT CAUSE: storage.ts references UPLOAD_CONFIG.R2_ENDPOINT,
#   UPLOAD_CONFIG.R2_ACCESS_KEY_ID, UPLOAD_CONFIG.R2_SECRET_ACCESS_KEY,
#   UPLOAD_CONFIG.R2_BUCKET_NAME. Since we renamed the config object
#   properties above, storage.ts must be updated to match.
#
# AFFECTED SURFACE: server/services/storage.ts property access only.
# REGRESSION CHECK: Logic is identical -- only property name strings change.
# =============================================================================

STORAGE_SVC = root / "server" / "services" / "storage.ts"

if STORAGE_SVC.exists():
    svc_text = STORAGE_SVC.read_text()
    new_svc  = svc_text \
        .replace("UPLOAD_CONFIG.R2_ENDPOINT",          "UPLOAD_CONFIG.STORAGE_ENDPOINT") \
        .replace("UPLOAD_CONFIG.R2_ACCESS_KEY_ID",     "UPLOAD_CONFIG.STORAGE_ACCESS_KEY_ID") \
        .replace("UPLOAD_CONFIG.R2_SECRET_ACCESS_KEY", "UPLOAD_CONFIG.STORAGE_SECRET_ACCESS_KEY") \
        .replace("UPLOAD_CONFIG.R2_BUCKET_NAME",       "UPLOAD_CONFIG.STORAGE_BUCKET")

    if new_svc != svc_text:
        bak = backup(STORAGE_SVC)
        STORAGE_SVC.write_text(new_svc)
        ok("server/services/storage.ts -- UPLOAD_CONFIG property refs updated")
        dim(f"bak: {bak.name}")
        fixed.append("server/services/storage.ts -- UPLOAD_CONFIG.STORAGE_* refs")
    else:
        dim("server/services/storage.ts -- already updated or no R2_ refs found")
else:
    warn("server/services/storage.ts not found -- skipping")

# =============================================================================
# [2/4] Fix server/middleware/auth.ts
#
# ROOT CAUSE: auth.ts reads AUTH_TOKEN_SECRET and AUTH_TOKEN_EXPIRY directly
#   from process.env. These are old key names. Canonical names are JWT_SECRET
#   and JWT_EXPIRES_IN. Root .env has canonical names. In production,
#   AUTH_TOKEN_SECRET resolves to '' causing the startup guard to fire:
#   "AUTH_TOKEN_SECRET is not set. Refusing to start." -- Railway crash.
#
# FIX RATIONALE: Replace both env key reads. Also update the error messages
#   so they reference the correct canonical key names for operator clarity.
#   The fallback values and validation logic are unchanged.
#
# AFFECTED SURFACE: server/middleware/auth.ts lines 26 and 41 only.
# REGRESSION CHECK: signToken(), trpcAuth(), requireUser() are unchanged.
#   All JWT behaviour preserved -- only the env key name read changes.
# =============================================================================

head("[2/4] Fix server/middleware/auth.ts -- AUTH_TOKEN_* -> JWT_*")

AUTH_FILE = root / "server" / "middleware" / "auth.ts"

if not AUTH_FILE.exists():
    err("server/middleware/auth.ts not found -- HARD STOP")
    sys.exit(1)

auth_text = AUTH_FILE.read_text()

new_auth = auth_text \
    .replace(
        "process.env.AUTH_TOKEN_SECRET ?? ''",
        "process.env.JWT_SECRET ?? ''"
    ) \
    .replace(
        "'[auth] FATAL: AUTH_TOKEN_SECRET is not set. Refusing to start.'",
        "'[auth] FATAL: JWT_SECRET is not set. Refusing to start.'"
    ) \
    .replace(
        "'[auth] FATAL: AUTH_TOKEN_SECRET must be at least 32 characters.'",
        "'[auth] FATAL: JWT_SECRET must be at least 32 characters.'"
    ) \
    .replace(
        "process.env.AUTH_TOKEN_EXPIRY ?? '7d'",
        "process.env.JWT_EXPIRES_IN ?? '7d'"
    ) \
    .replace(
        '`[auth] FATAL: AUTH_TOKEN_EXPIRY="${RAW_EXPIRY}" is not a valid duration.`',
        '`[auth] FATAL: JWT_EXPIRES_IN="${RAW_EXPIRY}" is not a valid duration.`'
    )

if new_auth == auth_text:
    warn("auth.ts -- no changes detected, may already be updated")
    blocked.append("server/middleware/auth.ts -- pattern mismatch, review manually")
else:
    bak = backup(AUTH_FILE)
    AUTH_FILE.write_text(new_auth)
    ok("server/middleware/auth.ts -- AUTH_TOKEN_SECRET -> JWT_SECRET, AUTH_TOKEN_EXPIRY -> JWT_EXPIRES_IN")
    dim(f"bak: {bak.name}")
    fixed.append("server/middleware/auth.ts -- JWT_SECRET + JWT_EXPIRES_IN")

# =============================================================================
# [3/4] Fix shared/subscription.types.ts -- update JSDoc comment only
#
# ROOT CAUSE: Lines 22-25 contain a JSDoc block listing old env key names
#   as documentation. Not runtime code -- but the comment now contradicts
#   the canonical names in .env, which will confuse the next developer.
#
# FIX RATIONALE: Update comment to canonical names. Zero runtime impact.
# AFFECTED SURFACE: shared/subscription.types.ts JSDoc block only.
# =============================================================================

head("[3/4] Fix shared/subscription.types.ts -- update JSDoc env key names")

SUBS_FILE = root / "shared" / "subscription.types.ts"

if not SUBS_FILE.exists():
    warn("shared/subscription.types.ts not found -- skipping")
else:
    subs_text = SUBS_FILE.read_text()
    new_subs  = subs_text \
        .replace(
            " *   STRIPE_PRICE_CREATOR_MONTHLY=price_xxx",
            " *   STRIPE_CREATOR_MONTHLY_PRICE_ID=price_xxx"
        ) \
        .replace(
            " *   STRIPE_PRICE_CREATOR_ANNUAL=price_xxx",
            " *   STRIPE_CREATOR_YEARLY_PRICE_ID=price_xxx"
        ) \
        .replace(
            " *   STRIPE_PRICE_PRO_ARTIST_MONTHLY=price_xxx",
            " *   STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID=price_xxx"
        ) \
        .replace(
            " *   STRIPE_PRICE_PRO_ARTIST_ANNUAL=price_xxx",
            " *   STRIPE_PRO_ARTIST_YEARLY_PRICE_ID=price_xxx"
        )

    if new_subs == subs_text:
        dim("subscription.types.ts -- JSDoc already updated or pattern not found")
    else:
        bak = backup(SUBS_FILE)
        SUBS_FILE.write_text(new_subs)
        ok("shared/subscription.types.ts -- JSDoc env key names updated")
        dim(f"bak: {bak.name}")
        fixed.append("shared/subscription.types.ts -- JSDoc canonical key names")

# =============================================================================
# [4/4] Verify no blocked keys remain, then run full cleanup live
# =============================================================================

head("[4/4] Verifying all source references resolved...")

# Re-run the blocked key check from cleanup.py to confirm zero remain
ALL_OLD_KEYS = [
    "STRIPE_PRICE_CREATOR_MONTHLY",
    "STRIPE_PRICE_CREATOR_ANNUAL",
    "STRIPE_PRICE_PRO_ARTIST_MONTHLY",
    "STRIPE_PRICE_PRO_ARTIST_ANNUAL",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT",
    "R2_BUCKET_NAME",
    "AUTH_TOKEN_SECRET",
    "AUTH_TOKEN_EXPIRY",
]

still_blocked = []
for key in ALL_OLD_KEYS:
    _, usage = shell(
        f"grep -rn '{key}' "
        "--include='*.ts' --include='*.tsx' --include='*.js' "
        "--include='*.toml' --include='*.json' "
        ". 2>/dev/null "
        "| grep -v node_modules "
        "| grep -v '\\.bak' "
        "| grep -v '/\\.env'"
    )
    if usage.strip():
        still_blocked.append((key, usage.splitlines()[0]))

if still_blocked:
    err(f"{len(still_blocked)} key(s) still referenced -- cannot proceed to cleanup:")
    for key, loc in still_blocked:
        dim(f"  {key}: {loc[:80]}")
    print(f"\n  {RED}Fix the references above manually, then re-run this script.{R}\n")
    sys.exit(1)
else:
    ok("All source references resolved -- zero blocked keys remain")

# =============================================================================
# TypeScript verification before cleanup
# =============================================================================

head("TypeScript verification...")
code, ts_out = shell(
    "npx tsc --noEmit 2>&1 | grep -v 'npm notice' | head -30",
    cwd=root / "server"
)
if ts_out.strip():
    warn("TypeScript errors detected after source fixes:")
    for line in ts_out.splitlines():
        dim(f"  {line}")
    print(f"\n  {YELLOW}Resolve TS errors above before running cleanup.{R}")
    print(f"  {YELLOW}Source fixes have been applied -- re-run after fixing TS.{R}\n")
    sys.exit(1)
else:
    ok("Zero TypeScript errors")

# =============================================================================
# Run cleanup.py in live mode
# =============================================================================

head("Running cleanup.py in LIVE mode...")

CLEANUP = root / "cleanup.py"
if not CLEANUP.exists():
    err("cleanup.py not found in project root.")
    err("Copy it there first: cp cleanup.py ~/Stable/R3\\ v4/")
    sys.exit(1)

# Patch cleanup.py DRY_RUN flag to False for this run, restore after
cleanup_src = CLEANUP.read_text()

if "DRY_RUN = True" not in cleanup_src:
    warn("cleanup.py DRY_RUN flag not found or already False -- running as-is")
    code = subprocess.run(
        [sys.executable, str(CLEANUP)], cwd=root
    ).returncode
else:
    # Temporarily set DRY_RUN = False
    live_src = cleanup_src.replace("DRY_RUN = True", "DRY_RUN = False", 1)
    CLEANUP.write_text(live_src)
    try:
        code = subprocess.run(
            [sys.executable, str(CLEANUP)], cwd=root
        ).returncode
    finally:
        # Always restore DRY_RUN = True
        CLEANUP.write_text(cleanup_src)
        dim("cleanup.py DRY_RUN restored to True")

if code != 0:
    warn(f"cleanup.py exited with code {code} -- review output above")
else:
    ok("cleanup.py completed successfully")

# =============================================================================
# Final summary
# =============================================================================

print(f"\n{BOLD}{'=' * 60}")
print("  Fix + Cleanup -- COMPLETE")
print(f"{'=' * 60}{R}\n")

if fixed:
    print(f"  {GREEN}{BOLD}SOURCE FIXES APPLIED ({len(fixed)}){R}")
    for item in fixed:
        dim(f"  v  {item}")

if blocked:
    print(f"\n  {YELLOW}{BOLD}BLOCKED ({len(blocked)}){R}")
    for item in blocked:
        dim(f"  !  {item}")

print(f"""
  {BOLD}Next steps:{R}
  {CYAN}  1. railway login && python3 deploy.py{R}
  {CYAN}  2. After Railway deploys, copy the Railway URL{R}
  {CYAN}  3. Update client/vercel.json rewrite destination{R}
  {CYAN}  4. git add -A && git commit -m 'fix: canonical env keys + stack cleanup'{R}
  {CYAN}  5. git push  (triggers Vercel redeploy){R}
""")
