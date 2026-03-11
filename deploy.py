#!/usr/bin/env python3
"""
R3 v4 - Master Deployment Script
==================================
Handles the complete launch sequence in a single run:

  1. Git        - commit all changes, push to GitHub
  2. Env        - interactive .env builder with validation
  3. Railway    - install CLI, login, deploy backend, capture URL
  4. Vercel     - install CLI, login, deploy frontend with backend URL
  5. Stripe     - register webhook endpoint via Stripe API
  6. Verify     - hit /api/health on live backend to confirm boot

Requirements: git, node, pnpm already installed (they are on your machine).
Everything else is installed automatically.
"""

import sys
import os
import json
import shutil
import subprocess
import time
import urllib.request
import urllib.error
from pathlib import Path
from getpass import getpass

# ── Colours ────────────────────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
CYAN   = "\033[36m"
DIM    = "\033[2m"

def ok(msg):   print(f"{GREEN}  ✓  {msg}{RESET}")
def warn(msg): print(f"{YELLOW}  ⚠  {msg}{RESET}")
def err(msg):  print(f"{RED}  ✗  {msg}{RESET}")
def info(msg): print(f"{CYAN}  →  {msg}{RESET}")
def head(msg): print(f"\n{BOLD}{msg}{RESET}")
def dim(msg):  print(f"{DIM}      {msg}{RESET}")

# ── Locate project root ────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
root = SCRIPT_DIR
for _ in range(8):
    if (root / "server").is_dir() and (root / "client").is_dir():
        break
    root = root.parent
else:
    err("Cannot locate project root. Run from inside R3 v4/")
    sys.exit(1)

def run(cmd, cwd=None, capture=False, env=None):
    cwd = cwd or root
    if capture:
        r = subprocess.run(cmd, shell=True, cwd=cwd,
                           capture_output=True, text=True, env=env)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    else:
        r = subprocess.run(cmd, shell=True, cwd=cwd, env=env)
        return r.returncode

def require(cmd):
    code, out, _ = run(f"command -v {cmd}", capture=True)
    return code == 0

def npm_global(pkg, bin_name=None):
    bin_name = bin_name or pkg
    if require(bin_name):
        return True
    info(f"Installing {pkg}...")
    code = run(f"npm install -g {pkg}")
    return code == 0

# ══════════════════════════════════════════════════════════════════════════════
print(f"\n{BOLD}{'=' * 60}")
print("  R3 v4 — Master Deployment")
print(f"{'=' * 60}{RESET}")
print(f"  Root: {root}\n")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Git commit + push
# ══════════════════════════════════════════════════════════════════════════════

head("[1/6] Git — commit and push")

# Check git repo
code, _, _ = run("git rev-parse --git-dir", capture=True)
if code != 0:
    info("Initialising git repository...")
    run("git init")
    run("git branch -M main")

# Check remote
code, remote_url, _ = run("git remote get-url origin", capture=True)
if code != 0:
    print()
    warn("No git remote set.")
    print("  Create a GitHub repo at https://github.com/new then paste the URL.")
    remote_url = input("  GitHub remote URL (e.g. https://github.com/you/r3): ").strip()
    if remote_url:
        run(f"git remote add origin {remote_url}")
        ok(f"Remote set: {remote_url}")
    else:
        warn("Skipping push — no remote provided.")
        remote_url = None
else:
    ok(f"Remote: {remote_url}")

# Stage and commit
code, status, _ = run("git status --porcelain", capture=True)
if status:
    run("git add -A")
    run('git commit -m "chore: audit complete + launch prep applied"')
    ok("Committed all changes")
else:
    ok("Nothing to commit — working tree clean")

# Push
if remote_url:
    code = run("git push -u origin main")
    if code == 0:
        ok("Pushed to GitHub")
    else:
        warn("Push failed — you may need to authenticate with GitHub.")
        warn("Run manually: git push -u origin main")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Environment variables
# ══════════════════════════════════════════════════════════════════════════════

head("[2/6] Environment — build .env")

ENV_FILE    = root / ".env"
ENV_EXAMPLE = root / ".env.example"

if not ENV_EXAMPLE.exists():
    err(".env.example not found — run launch-prep.py first")
    sys.exit(1)

existing_env = {}
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            existing_env[k.strip()] = v.strip()

def ask_env(key, prompt, secret=False, default=None):
    current = existing_env.get(key, default or "")
    display = f"[{current[:6]}...] " if (current and secret) else (f"[{current}] " if current else "")
    label = f"  {prompt} {display}: "
    if secret:
        val = getpass(label) or current
    else:
        val = input(label).strip() or current
    return val or ""

print("  Fill in each value. Press Enter to keep existing value shown in [brackets].\n")

VARS = {}

# Server
VARS["NODE_ENV"]    = "production"
VARS["PORT"]        = "3000"
VARS["APP_URL"]     = ask_env("APP_URL", "App URL (your domain or Railway URL if known)", default=existing_env.get("APP_URL", ""))

# Database
print()
VARS["DATABASE_URL"] = ask_env("DATABASE_URL", "Postgres DATABASE_URL", secret=True)

# Auth
print()
info("Generating JWT_SECRET automatically...")
code, jwt_secret, _ = run(
    "node -e \"process.stdout.write(require('crypto').randomBytes(64).toString('hex'))\"",
    capture=True
)
VARS["JWT_SECRET"]    = existing_env.get("JWT_SECRET") or (jwt_secret if code == 0 else "")
VARS["JWT_EXPIRES_IN"] = "7d"
if VARS["JWT_SECRET"]:
    ok("JWT_SECRET generated")
else:
    VARS["JWT_SECRET"] = ask_env("JWT_SECRET", "JWT secret (64-char hex)", secret=True)

# Stripe
print()
VARS["STRIPE_SECRET_KEY"]      = ask_env("STRIPE_SECRET_KEY", "Stripe secret key (sk_live_...)", secret=True)
VARS["STRIPE_WEBHOOK_SECRET"]  = existing_env.get("STRIPE_WEBHOOK_SECRET", "")  # set after webhook created
VARS["STRIPE_CREATOR_MONTHLY_PRICE_ID"]    = ask_env("STRIPE_CREATOR_MONTHLY_PRICE_ID",    "Stripe Creator monthly price ID")
VARS["STRIPE_CREATOR_YEARLY_PRICE_ID"]     = ask_env("STRIPE_CREATOR_YEARLY_PRICE_ID",     "Stripe Creator yearly price ID")
VARS["STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID"] = ask_env("STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID", "Stripe Pro Artist monthly price ID")
VARS["STRIPE_PRO_ARTIST_YEARLY_PRICE_ID"]  = ask_env("STRIPE_PRO_ARTIST_YEARLY_PRICE_ID",  "Stripe Pro Artist yearly price ID")

# Storage
print()
VARS["STORAGE_BUCKET"]            = ask_env("STORAGE_BUCKET", "S3/R2 bucket name", default="r3-uploads")
VARS["STORAGE_REGION"]            = ask_env("STORAGE_REGION", "Region (auto for R2)", default="auto")
VARS["STORAGE_ENDPOINT"]          = ask_env("STORAGE_ENDPOINT", "S3 endpoint URL (R2: https://<id>.r2.cloudflarestorage.com)")
VARS["STORAGE_ACCESS_KEY_ID"]     = ask_env("STORAGE_ACCESS_KEY_ID", "Storage access key ID", secret=True)
VARS["STORAGE_SECRET_ACCESS_KEY"] = ask_env("STORAGE_SECRET_ACCESS_KEY", "Storage secret access key", secret=True)
VARS["STORAGE_PUBLIC_URL"]        = ask_env("STORAGE_PUBLIC_URL", "Public URL for uploaded files")

# Write .env
env_lines = ["# R3 v4 — Environment Variables", "# Generated by deploy.py — do not commit", ""]
for k, v in VARS.items():
    env_lines.append(f"{k}={v}")
ENV_FILE.write_text("\n".join(env_lines) + "\n")
ok(".env written")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Railway (backend)
# ══════════════════════════════════════════════════════════════════════════════

head("[3/6] Railway — deploy backend")

if not npm_global("@railway/cli", "railway"):
    err("Failed to install Railway CLI. Install manually: npm i -g @railway/cli")
    sys.exit(1)
ok("Railway CLI ready")

# Login check
code, whoami, _ = run("railway whoami", capture=True)
if code != 0:
    info("Logging in to Railway (browser will open)...")
    run("railway login")
    code, whoami, _ = run("railway whoami", capture=True)
    if code != 0:
        err("Railway login failed.")
        sys.exit(1)
ok(f"Railway: logged in as {whoami}")

# Link or create project
code, _, _ = run("railway status", capture=True)
if code != 0:
    info("Creating new Railway project...")
    run("railway init")

# Set env vars on Railway
info("Pushing env vars to Railway...")
for k, v in VARS.items():
    if v:
        run(f"railway variables set {k}={v}", capture=True)
ok("Env vars set on Railway")

# Deploy
info("Deploying to Railway (this takes ~2 minutes)...")
code = run("railway up --detach")
if code != 0:
    err("Railway deploy failed — check output above.")
    sys.exit(1)

# Get backend URL
time.sleep(5)
code, railway_url, _ = run("railway domain", capture=True)
if not railway_url or code != 0:
    code, railway_url, _ = run("railway status --json", capture=True)
    try:
        status = json.loads(railway_url)
        railway_url = status.get("deploymentDomain", "")
    except Exception:
        railway_url = ""

if not railway_url:
    railway_url = input("  Paste your Railway backend URL (from dashboard): ").strip()

if not railway_url.startswith("http"):
    railway_url = f"https://{railway_url}"

ok(f"Backend: {railway_url}")

# Update APP_URL in Railway vars and local .env
run(f"railway variables set APP_URL={railway_url}", capture=True)
env_text = ENV_FILE.read_text().replace(
    f"APP_URL={VARS['APP_URL']}", f"APP_URL={railway_url}"
)
ENV_FILE.write_text(env_text)
VARS["APP_URL"] = railway_url

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Vercel (frontend)
# ══════════════════════════════════════════════════════════════════════════════

head("[4/6] Vercel — deploy frontend")

if not npm_global("vercel"):
    err("Failed to install Vercel CLI. Install manually: npm i -g vercel")
    sys.exit(1)
ok("Vercel CLI ready")

# Update vercel.json rewrite to point at real Railway URL
VERCEL_JSON = root / "client" / "vercel.json"
if VERCEL_JSON.exists():
    vj = VERCEL_JSON.read_text()
    if "your-backend.railway.app" in vj:
        domain = railway_url.replace("https://", "").replace("http://", "")
        VERCEL_JSON.write_text(vj.replace("your-backend.railway.app", domain))
        ok(f"vercel.json updated with Railway URL")

# Login check
code, vercel_whoami, _ = run("vercel whoami", capture=True)
if code != 0:
    info("Logging in to Vercel (browser will open)...")
    run("vercel login")

# Deploy from client/
info("Deploying frontend to Vercel...")
code, vercel_out, vercel_err = run(
    "vercel --prod --yes",
    cwd=root / "client",
    capture=True
)

vercel_url = ""
for line in (vercel_out + vercel_err).splitlines():
    if "vercel.app" in line or "Production:" in line:
        parts = line.split()
        for p in parts:
            if "vercel.app" in p or p.startswith("https://"):
                vercel_url = p.strip()
                break

if not vercel_url:
    vercel_url = input("  Paste your Vercel frontend URL: ").strip()

if vercel_url:
    ok(f"Frontend: {vercel_url}")
else:
    warn("Could not detect Vercel URL — check Vercel dashboard.")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Stripe webhook
# ══════════════════════════════════════════════════════════════════════════════

head("[5/6] Stripe — register webhook")

STRIPE_KEY = VARS.get("STRIPE_SECRET_KEY", "")
WEBHOOK_URL = f"{railway_url}/webhooks/stripe"

if not STRIPE_KEY or not STRIPE_KEY.startswith("sk_"):
    warn("No valid Stripe secret key — skipping webhook registration.")
    warn(f"Register manually: {WEBHOOK_URL}")
    warn("Events needed: customer.subscription.created, customer.subscription.updated,")
    warn("               customer.subscription.deleted, invoice.payment_failed")
else:
    info(f"Registering webhook: {WEBHOOK_URL}")
    try:
        payload = json.dumps({
            "url": WEBHOOK_URL,
            "enabled_events": [
                "customer.subscription.created",
                "customer.subscription.updated",
                "customer.subscription.deleted",
                "invoice.payment_failed",
            ]
        }).encode()

        req = urllib.request.Request(
            "https://api.stripe.com/v1/webhook_endpoints",
            data=payload,
            headers={
                "Authorization": f"Bearer {STRIPE_KEY}",
                "Content-Type": "application/json",
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            webhook_secret = data.get("secret", "")
            if webhook_secret:
                # Write to .env and Railway
                env_text = ENV_FILE.read_text().replace(
                    "STRIPE_WEBHOOK_SECRET=",
                    f"STRIPE_WEBHOOK_SECRET={webhook_secret}"
                )
                ENV_FILE.write_text(env_text)
                run(f"railway variables set STRIPE_WEBHOOK_SECRET={webhook_secret}", capture=True)
                ok(f"Webhook registered — secret written to .env and Railway")
            else:
                warn("Webhook created but no secret returned — check Stripe dashboard.")
    except Exception as e:
        warn(f"Stripe API call failed: {e}")
        warn(f"Register manually at https://dashboard.stripe.com/webhooks")
        warn(f"Endpoint URL: {WEBHOOK_URL}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Health check
# ══════════════════════════════════════════════════════════════════════════════

head("[6/6] Health check — verify live backend")

health_url = f"{railway_url}/api/health"
info(f"Polling {health_url} (up to 90 seconds)...")

alive = False
for attempt in range(18):
    try:
        req = urllib.request.Request(health_url, headers={"User-Agent": "r3-deploy"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            body = json.loads(resp.read())
            if body.get("status") == "ok":
                alive = True
                break
    except Exception:
        pass
    time.sleep(5)
    dim(f"attempt {attempt + 1}/18 ...")

if alive:
    ok("Backend is live and healthy")
else:
    warn("Backend did not respond in time — check Railway logs:")
    dim("railway logs")

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════

print(f"\n{BOLD}{'=' * 60}")
print("  Deployment Summary")
print(f"{'=' * 60}{RESET}\n")

if railway_url:
    print(f"  Backend  : {CYAN}{railway_url}{RESET}")
if vercel_url:
    print(f"  Frontend : {CYAN}{vercel_url}{RESET}")

print(f"""
  {BOLD}Post-deploy checklist:{RESET}
  {DIM}□{RESET}  Add custom domain in Vercel dashboard
  {DIM}□{RESET}  Add custom domain in Railway dashboard
  {DIM}□{RESET}  Set CORS origin in server to match frontend domain
  {DIM}□{RESET}  Enable Stripe live mode (currently may be test mode)
  {DIM}□{RESET}  Run database migrations: railway run pnpm db:migrate
  {DIM}□{RESET}  Test register → login → subscribe flow end to end
""")