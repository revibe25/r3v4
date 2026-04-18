#!/usr/bin/env python3
"""
r3diagnose.py — ASI-enhanced diagnostic + fix for R3 v4 runtime errors

Errors under investigation:
  ERR 1 — api/auth/login 500 Internal Server Error (critical — auth broken)
  ERR 2 — AudioContext autoplay policy blocked (Tone.js)

Wire.txt protocol:
  Phase 0  Pre-flight — files + env keys present
  Phase 1  Read auth route — find 500 root cause
  Phase 2  Read env files — confirm required keys exist (no values printed)
  Phase 3  Check DB reachability
  Phase 4  Check migration state
  Phase 5  Fix AudioContext autoplay (add Tone.start() on user gesture)
  Phase 6  Report + next steps

Run:
  python3 r3diagnose.py            # diagnose only (no writes)
  python3 r3diagnose.py --fix      # diagnose + apply AudioContext fix
"""

import os
import sys
import re
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

FIX   = "--fix" in sys.argv
ROOT  = Path.home() / "Stable"
TS    = datetime.now().strftime("%Y%m%d_%H%M%S")

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
def info(m): print(f"{CYN}ℹ  {m}{RST}")
def die(m):  print(f"{RED}✗  {m}{RST}", file=sys.stderr); sys.exit(1)
def hr():    print("─" * 60)
def sec(t):  hr(); print(f"  {t}"); hr()

def backup(path):
    bak = Path(str(path) + f".bak-{TS}")
    shutil.copy2(path, bak)
    ok(f"Backup: {bak.name}")
    return bak

def run_tsc():
    r = subprocess.run(["pnpm", "tsc", "--noEmit"],
                       cwd=ROOT, capture_output=True, text=True)
    errors = [l for l in (r.stdout + r.stderr).splitlines() if "error TS" in l]
    if errors:
        for e in errors[:10]: print(f"  {RED}{e}{RST}")
        return len(errors)
    ok("TSC: 0 errors ✓")
    return 0

# ================================================================
#  PHASE 0 — Pre-flight
# ================================================================
sec("PHASE 0 — PRE-FLIGHT")

required_files = [
    ROOT / "index.ts",
    ROOT / "server" / "procedures.ts",
]
auth_candidates = [
    ROOT / "server" / "routes" / "auth.ts",
    ROOT / "server" / "routers" / "auth.router.ts",
    ROOT / "server" / "routers" / "authRouter.ts",
    ROOT / "server" / "routes" / "auth.router.ts",
]
env_files = [
    ROOT / ".env",
    ROOT / "server" / ".env",
    ROOT / ".env.production",
]

for f in required_files:
    ok(f"{f.relative_to(ROOT)}") if f.exists() else warn(f"MISSING: {f.relative_to(ROOT)}")

auth_file = None
for c in auth_candidates:
    if c.exists():
        auth_file = c
        ok(f"Auth route: {c.relative_to(ROOT)}")
        break
if not auth_file:
    warn("Auth route file not found — searching...")
    for f in (ROOT / "server").rglob("*.ts"):
        txt = f.read_text()
        if "login" in txt and ("bcrypt" in txt or "jwt" in txt or "password" in txt):
            auth_file = f
            ok(f"Auth route found (by content): {f.relative_to(ROOT)}")
            break
    if not auth_file:
        die("Cannot find auth route file — cannot diagnose 500")

# ================================================================
#  PHASE 1 — Read auth route — find 500 root cause
# ================================================================
sec("PHASE 1 — READ AUTH ROUTE")

auth_text  = auth_file.read_text()
auth_lines = auth_text.splitlines()
log(f"{auth_file.relative_to(ROOT)}  ({len(auth_lines)} lines)")
print()

# Show full file
for i, ln in enumerate(auth_lines, 1):
    print(f"{DIM}  {i:4d}  {ln}{RST}")
print()

# Analyze for common 500 causes
log("Analyzing for 500 root causes...")

issues = []

# 1. DATABASE_URL reference
if "DATABASE_URL" in auth_text or "db" in auth_text or "drizzle" in auth_text.lower():
    ok("Uses DB — checking if DATABASE_URL is required")
else:
    warn("No DB reference found in auth — unusual")

# 2. JWT_SECRET reference
jwt_secret_name = None
for name in ["JWT_SECRET", "ACCESS_TOKEN_SECRET", "SECRET_KEY", "TOKEN_SECRET"]:
    if name in auth_text:
        jwt_secret_name = name
        ok(f"JWT secret var: {name}")
        break
if not jwt_secret_name:
    warn("No JWT secret env var reference found in auth route")
    issues.append("JWT_SECRET var name unknown")

# 3. bcrypt usage
if "bcrypt" in auth_text:
    ok("bcrypt: referenced")
else:
    warn("bcrypt not referenced in auth — check password comparison")

# 4. Error handling — does it swallow exceptions?
try_blocks = auth_text.count("try {")
catch_blocks = auth_text.count("catch")
bare_res500 = len(re.findall(r'res\.status\(500\)|statusCode.*500', auth_text))
dim(f"try/catch blocks: {try_blocks}/{catch_blocks}")
dim(f"bare res.status(500): {bare_res500}")

# 5. Look for the exact login handler
login_match = re.search(
    r'(router\.(post|get)\([\'\"]/?(login|auth)[^)]*\).*?(?=router\.\w|$))',
    auth_text, re.DOTALL
)
if login_match:
    snippet = login_match.group(0)[:500]
    log("Login handler snippet:")
    for ln in snippet.splitlines():
        dim(f"  {ln}")

# 6. Check for process.env references that could be undefined
env_refs = re.findall(r'process\.env\.(\w+)', auth_text)
dim(f"process.env refs in auth: {env_refs}")

print()

# ================================================================
#  PHASE 2 — Check env files (keys only, no values)
# ================================================================
sec("PHASE 2 — ENV KEYS AUDIT (no values shown)")

REQUIRED_AUTH_KEYS = [
    "DATABASE_URL",
    "JWT_SECRET",
    "NODE_ENV",
]
REQUIRED_KEYS = REQUIRED_AUTH_KEYS + [
    "PORT",
    "STRIPE_SECRET_KEY",
    "ADMIN_EMAIL",
]

found_keys = {}

for env_path in env_files:
    if not env_path.exists():
        dim(f"  {env_path.relative_to(Path.home())} — not found")
        continue

    log(f"{env_path.relative_to(Path.home())}:")
    env_content = env_path.read_text()
    env_keys = []
    for line in env_content.splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key = line.split("=", 1)[0].strip()
            env_keys.append(key)
            found_keys[key] = env_path.name

    for key in env_keys:
        dim(f"  {key} ✓")
    print()

# Check required auth keys
log("Required auth keys:")
missing_auth_keys = []
for key in REQUIRED_AUTH_KEYS:
    if key in found_keys:
        ok(f"  {key} present in {found_keys[key]}")
    else:
        warn(f"  {key} MISSING — this will cause 500")
        missing_auth_keys.append(key)
        issues.append(f"Missing env key: {key}")

print()

# ================================================================
#  PHASE 3 — Check DB reachability
# ================================================================
sec("PHASE 3 — DATABASE REACHABILITY")

if "DATABASE_URL" not in found_keys:
    warn("DATABASE_URL not found — cannot test DB connection")
    warn("This is the most likely cause of the 500 error")
    info("Fix: add DATABASE_URL=<your-railway-postgresql-url> to ~/Stable/.env")
else:
    ok("DATABASE_URL key present — testing connection...")
    # Try a quick psql ping using the URL from the env file
    db_url = None
    for env_path in env_files:
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            if line.strip().startswith("DATABASE_URL="):
                db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
        if db_url:
            break

    if db_url:
        r = subprocess.run(
            ["node", "-e",
             f"const {{Pool}}=require('pg');const p=new Pool({{connectionString:'{db_url}',connectionTimeoutMillis:5000}});"
             f"p.query('SELECT 1').then(()=>{{console.log('DB_OK');p.end()}}).catch(e=>{{console.log('DB_FAIL:'+e.message);p.end()}})"],
            cwd=ROOT, capture_output=True, text=True, timeout=10
        )
        output = (r.stdout + r.stderr).strip()
        if "DB_OK" in output:
            ok("Database connection: SUCCESS ✓")
        elif "DB_FAIL" in output:
            err_msg = output.replace("DB_FAIL:", "")
            warn(f"Database connection FAILED: {err_msg}")
            issues.append(f"DB connection failed: {err_msg}")
        else:
            warn(f"DB test inconclusive: {output[:200]}")
    else:
        warn("Could not extract DATABASE_URL value for testing")

print()

# ================================================================
#  PHASE 4 — Check migration state
# ================================================================
sec("PHASE 4 — MIGRATION STATE")

drizzle_dir = ROOT / "drizzle"
if drizzle_dir.exists():
    migrations = sorted(drizzle_dir.glob("*.sql"))
    ok(f"Migration files: {len(migrations)}")
    for m in migrations:
        dim(f"  {m.name}")
else:
    warn("drizzle/ directory not found")

# Check if migration 0005 (aiDecisionLog) exists — PRIORITIES.md P0
mig_0005 = list(drizzle_dir.glob("0005_*.sql")) if drizzle_dir.exists() else []
mig_0006 = list(drizzle_dir.glob("0006_*.sql")) if drizzle_dir.exists() else []

if mig_0005:
    warn(f"Migration 0005 exists locally but may not be applied to Railway: {mig_0005[0].name}")
    warn("PRIORITIES.md P0: run 'pnpm drizzle-kit migrate' to apply to Railway DB")
    issues.append("Migration 0005 may not be applied to Railway DB")
if not mig_0006:
    info("Migration 0006 (materialized views) not yet generated — PRIORITIES.md P4")

print()

# ================================================================
#  PHASE 5 — AudioContext autoplay fix
# ================================================================
sec("PHASE 5 — AUDIOCONTEXT AUTOPLAY FIX")

# Find where Tone.js / AudioContext is initialized
# ERR 2: AudioContext blocked until user gesture
# Fix: add Tone.start() call on first user interaction

tone_init_candidates = [
    ROOT / "client" / "src" / "stores" / "dawStore.ts",
    ROOT / "client" / "src" / "stores" / "daw.store.ts",
    ROOT / "client" / "src" / "store" / "dawStore.ts",
    ROOT / "client" / "src" / "hooks" / "useAudio.ts",
    ROOT / "client" / "src" / "hooks" / "useTone.ts",
    ROOT / "client" / "src" / "pages" / "DAW.tsx",
    ROOT / "client" / "src" / "components" / "Transport.tsx",
]

tone_file = None
for c in tone_init_candidates:
    if c.exists() and "Tone" in c.read_text():
        tone_file = c
        ok(f"Tone.js usage: {c.relative_to(ROOT)}")
        # Check if already has resume/start handling
        tone_txt = c.read_text()
        if "Tone.start()" in tone_txt or "Tone.getContext().resume" in tone_txt:
            ok("Tone.start() already present")
        else:
            warn("Tone.start() NOT called on user gesture")
        break

# Find main App.tsx or index entry for gesture handler
app_tsx = ROOT / "client" / "src" / "App.tsx"
if app_tsx.exists():
    app_text = app_tsx.read_text()
    if "Tone.start()" in app_text:
        ok("App.tsx: Tone.start() on gesture already present")
    else:
        warn("App.tsx: Tone.start() on gesture MISSING")
        info("Fix: add onClick/onKeyDown handler that calls Tone.start()")

# Find DAW.tsx transport controls — best place for Tone.start()
daw_tsx = ROOT / "client" / "src" / "pages" / "DAW.tsx"
if daw_tsx.exists():
    daw_txt  = daw_tsx.read_text()
    daw_lns  = daw_txt.splitlines(keepends=True)

    # Look for transport play button handler
    play_handler_lines = []
    for i, ln in enumerate(daw_lns):
        if ("togglePlay" in ln or "handlePlay" in ln or "SPACE" in ln) and "function" not in ln.lower():
            play_handler_lines.append((i+1, ln.rstrip()))

    if play_handler_lines:
        log("Play-related handlers in DAW.tsx:")
        for lineno, ln in play_handler_lines[:5]:
            dim(f"  {lineno}: {ln}")

    # Find the togglePlay or play function definition
    play_func_match = re.search(
        r'(const\s+(?:togglePlay|handlePlay|play)\s*=.*?(?=\n\s*const|\n\s*function|\Z))',
        daw_txt, re.DOTALL
    )
    if play_func_match:
        snippet = play_func_match.group(0)[:400]
        log("Play function:")
        for ln in snippet.splitlines():
            dim(f"  {ln}")
        # Check if Tone.start() is in the play function
        if "Tone.start()" in snippet or "Tone.getContext().resume" in snippet:
            ok("Tone.start() already in play handler ✓")
        else:
            warn("Tone.start() not in play handler — needs adding")
            info("Will inject 'await Tone.start()' at top of play handler")

print()

# ================================================================
#  PHASE 5b — Apply AudioContext fix if --fix passed
# ================================================================
if FIX and daw_tsx.exists():
    daw_txt = daw_tsx.read_text()

    # Find togglePlay function and insert Tone.start()
    # Pattern: const togglePlay = async () => { or const togglePlay = () => {
    play_pattern = re.compile(
        r'(const\s+(?:togglePlay|handlePlay)\s*=\s*async\s*\(\s*\)\s*=>\s*\{)'
    )
    match = play_pattern.search(daw_txt)

    if match:
        insert_after = match.end()
        # Check if Tone.start() is already there
        next_50 = daw_txt[insert_after:insert_after+200]
        if "Tone.start()" in next_50:
            ok("Tone.start() already present in play handler — no change needed")
        else:
            # Get indentation of the line after opening brace
            indent = "    "  # default 4 spaces
            newline_pos = daw_txt.find("\n", insert_after)
            if newline_pos != -1:
                next_line = daw_txt[newline_pos+1:]
                indent_match = re.match(r'(\s+)', next_line)
                if indent_match:
                    indent = indent_match.group(1)

            injection = f"\n{indent}// Resume AudioContext on first user gesture (browser autoplay policy)\n{indent}await Tone.start();\n"

            bak = backup(daw_tsx)
            patched = daw_txt[:insert_after] + injection + daw_txt[insert_after:]
            daw_tsx.write_text(patched)
            ok(f"Injected Tone.start() into play handler")

            # TSC gate
            err = run_tsc()
            if err > 0:
                shutil.copy2(bak, daw_tsx)
                warn(f"TSC failed after AudioContext fix ({err} errors) — DAW.tsx restored")
            else:
                ok("TSC gate after AudioContext fix: 0 errors ✓")
    else:
        warn("Could not find togglePlay/handlePlay function — manual fix needed")
        info("Add 'await Tone.start();' at the top of your play handler function")

print()

# ================================================================
#  PHASE 6 — Summary + next steps
# ================================================================
sec("PHASE 6 — DIAGNOSIS SUMMARY + NEXT STEPS")

print(f"\n  {'ISSUE':<45} {'STATUS'}")
print(f"  {'─'*45} {'─'*12}")

if missing_auth_keys:
    for k in missing_auth_keys:
        print(f"  {f'Missing env key: {k}':<45} {RED}BLOCKING{RST}")
else:
    print(f"  {'Env keys (JWT_SECRET, DATABASE_URL)':<45} {ACID}PRESENT{RST}")

db_issue = [i for i in issues if "DB connection" in i]
if db_issue:
    print(f"  {'Database connection':<45} {RED}FAILING{RST}")
else:
    print(f"  {'Database connection':<45} {ACID}OK{RST}")

mig_issue = [i for i in issues if "Migration" in i]
if mig_issue:
    print(f"  {'Migration 0005 applied to Railway':<45} {YLW}UNVERIFIED{RST}")
else:
    print(f"  {'Migration 0005 applied to Railway':<45} {YLW}CHECK NEEDED{RST}")

print(f"  {'AudioContext autoplay (Tone.js)':<45} {YLW}BROWSER POLICY{RST}")
print()

print(f"  {CYN}Next steps in priority order:{RST}\n")

step = 1
if missing_auth_keys:
    for k in missing_auth_keys:
        print(f"  {step}. Add {k} to ~/Stable/.env")
        step += 1

print(f"  {step}. Apply migration 0005 to Railway DB:")
print(f"       cd ~/Stable && pnpm drizzle-kit migrate")
step += 1

print(f"  {step}. Check server logs for 500 detail:")
print(f"       pnpm dev 2>&1 | grep -A5 'login\\|500\\|Error'")
step += 1

print(f"  {step}. AudioContext — add to play handler if not already present:")
print(f"       await Tone.start();  // before any Tone scheduling")
step += 1

print(f"  {step}. If DATABASE_URL is Railway — confirm Railway service is running:")
print(f"       railway status  (or check Railway dashboard)")
step += 1

print()
if not FIX:
    print(f"  {YLW}Run with --fix to apply AudioContext patch automatically.{RST}\n")
