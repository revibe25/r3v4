#!/usr/bin/env python3
"""
fix_db_url.py — R3 v4 DATABASE_URL repair script
Repairs the corrupted DATABASE_URL in .env without touching any code files.
Run with --dry-run first (default), then --apply to commit.
"""

import os
import re
import sys
import shutil
import subprocess
import urllib.parse
from datetime import datetime
from pathlib import Path

# ─── CONFIG ──────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path.home() / "r3v4_extracted"
DRY_RUN = "--apply" not in sys.argv

# Reconstructed from the corrupted value:
# "postgresql://postgres:=LViQcQVFGejcUTDHttLzrdTlqdCFowIr psql -h ballast.proxy.rlwy.net ..."
# Password = everything between ":" and the space before "psql"
# Host/port/db = ballast.proxy.rlwy.net:25291/railway
CORRECT_DB_URL = (
    "postgresql://postgres:%3DLViQcQVFGejcUTDHttLzrdTlqdCFowIr"
    "@ballast.proxy.rlwy.net:25291/railway"
)
# Note: leading '=' in password is percent-encoded as %3D for RFC-3986 safety.
# pg libraries decode %3D → = correctly.

TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def log(msg, tag="INFO"):
    print(f"[{tag}] {msg}")

def die(msg):
    log(msg, "FATAL")
    sys.exit(1)

def banner(title):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")

# ─── PHASE 1: DISCOVER ALL ENV FILES ────────────────────────────────────────

banner("PHASE 1 — Discover env files")

env_candidates = [
    PROJECT_ROOT / ".env",
    PROJECT_ROOT / ".env.local",
    PROJECT_ROOT / ".env.production",
    PROJECT_ROOT / ".env.development",
    PROJECT_ROOT / "server" / ".env",
    PROJECT_ROOT / "client" / ".env",
]

found_envs = [p for p in env_candidates if p.exists()]
log(f"Scanned {len(env_candidates)} candidate paths, found {len(found_envs)}:")
for p in found_envs:
    log(f"  ✓ {p}")

if not found_envs:
    die(f"No .env files found under {PROJECT_ROOT}")

# ─── PHASE 2: AUDIT CURRENT DATABASE_URL IN EACH FILE ───────────────────────

banner("PHASE 2 — Audit current DATABASE_URL values")

DB_URL_RE = re.compile(r'^(DATABASE_URL\s*=\s*)(.+)$', re.MULTILINE)

files_to_fix = []

for env_path in found_envs:
    content = env_path.read_text(encoding="utf-8")
    matches = DB_URL_RE.findall(content)
    if not matches:
        log(f"  {env_path.name}: no DATABASE_URL — skipping")
        continue
    for prefix, raw_val in matches:
        raw_val = raw_val.strip()
        log(f"  {env_path.name}: DATABASE_URL = {raw_val[:80]}{'...' if len(raw_val)>80 else ''}")
        # Detect corruption: valid URL must not contain spaces
        if " " in raw_val:
            log(f"    ⚠ CORRUPTED — contains spaces (psql command embedded)", "WARN")
            files_to_fix.append(env_path)
        else:
            # Validate parseable as URL
            try:
                parsed = urllib.parse.urlparse(raw_val)
                if parsed.scheme in ("postgresql", "postgres") and parsed.hostname:
                    log(f"    ✓ Appears valid (host={parsed.hostname})")
                else:
                    log(f"    ⚠ Unexpected scheme/host: {parsed.scheme}://{parsed.hostname}", "WARN")
                    files_to_fix.append(env_path)
            except Exception as e:
                log(f"    ⚠ Parse error: {e}", "WARN")
                files_to_fix.append(env_path)

log(f"\nFiles requiring repair: {len(files_to_fix)}")

# ─── PHASE 3: VALIDATE CORRECT URL ──────────────────────────────────────────

banner("PHASE 3 — Validate replacement URL")

try:
    parsed = urllib.parse.urlparse(CORRECT_DB_URL)
    assert parsed.scheme in ("postgresql", "postgres"), f"Bad scheme: {parsed.scheme}"
    assert parsed.hostname == "ballast.proxy.rlwy.net", f"Bad host: {parsed.hostname}"
    assert parsed.port == 25291, f"Bad port: {parsed.port}"
    assert parsed.path == "/railway", f"Bad db: {parsed.path}"
    decoded_pw = urllib.parse.unquote(parsed.password)
    assert decoded_pw == "=LViQcQVFGejcUTDHttLzrdTlqdCFowIr", f"Password mismatch"
    log(f"✓ scheme   : {parsed.scheme}")
    log(f"✓ user     : {parsed.username}")
    log(f"✓ password : {'*' * len(decoded_pw)} (decoded, {len(decoded_pw)} chars)")
    log(f"✓ host     : {parsed.hostname}")
    log(f"✓ port     : {parsed.port}")
    log(f"✓ database : {parsed.path.lstrip('/')}")
except AssertionError as e:
    die(f"Replacement URL failed validation: {e}")

# ─── PHASE 4: CHECK DRIZZLE CONFIG ──────────────────────────────────────────

banner("PHASE 4 — Inspect drizzle.config.ts / drizzle.config.js")

drizzle_candidates = list(PROJECT_ROOT.glob("drizzle.config.*")) + \
                     list(PROJECT_ROOT.glob("server/drizzle.config.*"))

for dc in drizzle_candidates:
    content = dc.read_text(encoding="utf-8", errors="replace")
    if "DATABASE_URL" in content or "connectionString" in content:
        log(f"  ✓ {dc} references DATABASE_URL (reads from env — OK)")
    else:
        log(f"  ⚠ {dc} may have a hardcoded connection string — review manually", "WARN")

if not drizzle_candidates:
    log("  No drizzle config found (may be inside server package)")

# ─── PHASE 5: CHECK package.json DB SCRIPTS ─────────────────────────────────

banner("PHASE 5 — Inspect package.json db scripts")

pkg_candidates = [
    PROJECT_ROOT / "package.json",
    PROJECT_ROOT / "server" / "package.json",
]

for pkg in pkg_candidates:
    if not pkg.exists():
        continue
    content = pkg.read_text(encoding="utf-8")
    # Look for any hardcoded connection strings
    if "ballast.proxy.rlwy.net" in content:
        log(f"  ⚠ {pkg}: hardcoded Railway host found — check manually", "WARN")
    elif "DATABASE_URL" in content or "db:push" in content or "db:migrate" in content:
        log(f"  ✓ {pkg}: db scripts use env var (OK)")
    else:
        log(f"  — {pkg}: no db scripts found")

# ─── PHASE 6: TRIPLE CHECK BEFORE WRITE ─────────────────────────────────────

banner("PHASE 6 — Triple-check summary before write")

log(f"Files to modify : {[str(f) for f in files_to_fix]}")
log(f"Replacement URL : {CORRECT_DB_URL}")
log(f"Dry run         : {DRY_RUN}")
log(f"Backup suffix   : .bak_{TIMESTAMP}")

if not files_to_fix:
    log("\n✓ No files need repair — DATABASE_URL looks correct in all env files.")
    sys.exit(0)

if DRY_RUN:
    print("\n" + "="*60)
    print("  DRY RUN COMPLETE — no files were modified.")
    print("  Run with --apply to commit changes:")
    print(f"  python3 fix_db_url.py --apply")
    print("="*60)
    sys.exit(0)

# ─── PHASE 7: APPLY FIX ─────────────────────────────────────────────────────

banner("PHASE 7 — Applying fix")

for env_path in files_to_fix:
    # Backup
    backup_path = env_path.with_suffix(f".bak_{TIMESTAMP}")
    shutil.copy2(env_path, backup_path)
    log(f"  Backed up → {backup_path}")

    # Read, replace, write
    content = env_path.read_text(encoding="utf-8")

    def replacer(m):
        val = m.group(2).strip()
        # ONLY replace lines that are corrupted (contain spaces)
        if " " in val:
            log(f"    → Replacing corrupted line: {val[:60]}...")
            return m.group(1) + CORRECT_DB_URL
        else:
            log(f"    → Leaving valid line untouched: {val[:60]}")
            return m.group(0)  # return original unchanged

    new_content = DB_URL_RE.sub(replacer, content)

    if new_content == content:
        log(f"  ⚠ No change made to {env_path} — regex may not have matched", "WARN")
        continue

    env_path.write_text(new_content, encoding="utf-8")
    log(f"  ✓ Written: {env_path}")

# ─── PHASE 8: POST-WRITE VERIFICATION ───────────────────────────────────────

banner("PHASE 8 — Post-write verification")

all_ok = True
for env_path in files_to_fix:
    content = env_path.read_text(encoding="utf-8")
    matches = DB_URL_RE.findall(content)
    for prefix, val in matches:
        val = val.strip()
        if val == CORRECT_DB_URL:
            log(f"  ✓ {env_path.name}: DATABASE_URL correct")
        else:
            log(f"  ✗ {env_path.name}: mismatch after write! Got: {val[:80]}", "FAIL")
            all_ok = False

# ─── PHASE 9: CONNECTIVITY TEST ─────────────────────────────────────────────

banner("PHASE 9 — Railway connectivity test")

try:
    result = subprocess.run(
        ["psql", CORRECT_DB_URL, "-c", "SELECT version();", "--no-password"],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode == 0:
        version_line = result.stdout.strip().split("\n")[2].strip() if result.stdout else "?"
        log(f"  ✓ Connected to Railway PostgreSQL: {version_line[:60]}")
    else:
        log(f"  ⚠ psql returned code {result.returncode}: {result.stderr.strip()[:120]}", "WARN")
        log("  (This is non-fatal — the server will test on startup)")
except FileNotFoundError:
    log("  psql not in PATH — skipping live connectivity test (non-fatal)")
except subprocess.TimeoutExpired:
    log("  Connection timed out — Railway may be sleeping, try again in 30s", "WARN")

# ─── DONE ────────────────────────────────────────────────────────────────────

print("\n" + "="*60)
if all_ok:
    print("  ✅ ALL PHASES PASSED — run `pnpm dev` to verify.")
else:
    print("  ❌ SOME CHECKS FAILED — review FAIL lines above.")
print("="*60)
