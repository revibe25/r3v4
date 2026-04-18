#!/usr/bin/env python3
"""
r3scan.py — Deep read before any write.
Reads all relevant files to understand DB, admin, register, AudioContext state.
No writes. Output feeds r3wire.py.
"""
import re, sys, subprocess
from pathlib import Path

ROOT = Path.home() / "Stable"

ACID="\033[38;2;163;230;53m"; DIM="\033[2m"; RED="\033[0;31m"
YLW="\033[0;33m"; CYN="\033[0;36m"; RST="\033[0m"
def log(m): print(f"{ACID}▸{RST} {m}")
def dim(m): print(f"{DIM}  {m}{RST}")
def warn(m): print(f"{YLW}⚠  {m}{RST}")
def ok(m): print(f"{ACID}✓{RST}  {m}")
def info(m): print(f"{CYN}ℹ  {m}{RST}")
def hr(): print("─"*60)
def sec(t): hr(); print(f"  {t}"); hr()

# ── SCAN 1: DB & migration files ─────────────────────────────────
sec("SCAN 1 — DB & MIGRATION FILES")

drizzle_dir = ROOT / "drizzle"
if drizzle_dir.exists():
    all_files = list(drizzle_dir.rglob("*"))
    log(f"drizzle/ contents ({len(all_files)} items):")
    for f in sorted(all_files)[:30]:
        dim(f"  {f.relative_to(ROOT)}")
else:
    warn("drizzle/ directory missing entirely")

# Check drizzle.config.ts for DB connection info
drizzle_cfg = ROOT / "drizzle.config.ts"
if drizzle_cfg.exists():
    log("drizzle.config.ts:")
    for i, ln in enumerate(drizzle_cfg.read_text().splitlines(), 1):
        print(f"{DIM}  {i:3d}  {ln}{RST}")
print()

# Check schema location
schema_candidates = [
    ROOT / "server" / "db" / "schema.ts",
    ROOT / "db" / "schema.ts",
    ROOT / "shared" / "schema.ts",
]
for s in schema_candidates:
    if s.exists():
        ok(f"Schema: {s.relative_to(ROOT)} ({len(s.read_text().splitlines())} lines)")
        # Show table definitions
        for ln in s.read_text().splitlines():
            if "pgTable" in ln or "export const" in ln:
                dim(f"  {ln.strip()}")

# ── SCAN 2: storage.ts ───────────────────────────────────────────
sec("SCAN 2 — SERVER/STORAGE.TS")
storage_candidates = [
    ROOT / "server" / "storage.ts",
    ROOT / "server" / "lib" / "storage.ts",
    ROOT / "server" / "db" / "storage.ts",
]
storage_file = None
for s in storage_candidates:
    if s.exists():
        storage_file = s
        break
if storage_file:
    txt = storage_file.read_text()
    log(f"{storage_file.relative_to(ROOT)}  ({len(txt.splitlines())} lines)")
    for i, ln in enumerate(txt.splitlines(), 1):
        print(f"{DIM}  {i:3d}  {ln}{RST}")
else:
    warn("storage.ts not found")

# ── SCAN 3: PostgreSQL availability ─────────────────────────────
sec("SCAN 3 — POSTGRESQL LOCAL")
r = subprocess.run(["which", "psql"], capture_output=True, text=True)
if r.returncode == 0:
    ok(f"psql found: {r.stdout.strip()}")
    r2 = subprocess.run(["psql", "--version"], capture_output=True, text=True)
    dim(r2.stdout.strip())
else:
    warn("psql not installed locally")

r = subprocess.run(["pg_isready"], capture_output=True, text=True)
if r.returncode == 0:
    ok(f"PostgreSQL running: {r.stdout.strip()}")
else:
    warn(f"PostgreSQL not ready: {r.stdout.strip()} {r.stderr.strip()}")

# ── SCAN 4: Admin wiring ─────────────────────────────────────────
sec("SCAN 4 — ADMIN WIRING")
# Find admin-related files
admin_files = []
for pattern in ["*admin*", "*Admin*"]:
    admin_files.extend(ROOT.rglob(pattern))
admin_files = [f for f in admin_files if f.is_file() and
               f.suffix in [".ts", ".tsx"] and
               "node_modules" not in str(f) and
               ".bak" not in str(f)]
for af in sorted(admin_files):
    log(f"{af.relative_to(ROOT)}")
    txt = af.read_text()
    for i, ln in enumerate(txt.splitlines(), 1):
        print(f"{DIM}  {i:3d}  {ln}{RST}")
    print()

# Check how admin is enforced in index.ts
idx = ROOT / "index.ts"
if idx.exists():
    for i, ln in enumerate(idx.read_text().splitlines(), 1):
        if "admin" in ln.lower() or "ADMIN" in ln:
            dim(f"  index.ts:{i}: {ln.strip()}")

# ── SCAN 5: Login/Register form ──────────────────────────────────
sec("SCAN 5 — LOGIN / REGISTER FORM")
login_candidates = []
for pattern in ["*Login*", "*login*", "*Register*", "*register*", "*Auth*"]:
    login_candidates.extend((ROOT / "client").rglob(pattern))
login_candidates = [f for f in login_candidates if f.is_file() and
                    f.suffix in [".ts", ".tsx"] and
                    "node_modules" not in str(f) and
                    ".bak" not in str(f)]
for lf in sorted(login_candidates):
    log(f"{lf.relative_to(ROOT)}")
    txt = lf.read_text()
    for i, ln in enumerate(txt.splitlines(), 1):
        print(f"{DIM}  {i:3d}  {ln}{RST}")
    print()

# ── SCAN 6: Engine (togglePlay location) ────────────────────────
sec("SCAN 6 — DAW ENGINE (togglePlay)")
engine_candidates = []
for pattern in ["*engine*", "*Engine*", "*dawEngine*", "*useDAW*"]:
    engine_candidates.extend((ROOT / "client").rglob(pattern))
engine_candidates = [f for f in engine_candidates if f.is_file() and
                     f.suffix in [".ts", ".tsx"] and
                     "node_modules" not in str(f) and
                     ".bak" not in str(f)]
for ef in sorted(engine_candidates):
    log(f"{ef.relative_to(ROOT)}")
    txt = ef.read_text()
    for i, ln in enumerate(txt.splitlines(), 1):
        print(f"{DIM}  {i:3d}  {ln}{RST}")
    print()

# Also scan for togglePlay in all client files
log("togglePlay definition locations:")
for f in (ROOT / "client").rglob("*.ts*"):
    if "node_modules" in str(f) or ".bak" in str(f):
        continue
    txt = f.read_text()
    if "togglePlay" in txt and ("function togglePlay" in txt or "const togglePlay" in txt or "togglePlay:" in txt):
        for i, ln in enumerate(txt.splitlines(), 1):
            if "togglePlay" in ln and ("function" in ln or "const" in ln or "=>" in ln or ":" in ln):
                dim(f"  {f.relative_to(ROOT)}:{i}: {ln.strip()}")

# ── SCAN 7: Tone import locations ────────────────────────────────
sec("SCAN 7 — TONE.JS IMPORT LOCATIONS")
for f in (ROOT / "client").rglob("*.ts*"):
    if "node_modules" in str(f) or ".bak" in str(f):
        continue
    txt = f.read_text()
    if "from 'tone'" in txt or 'from "tone"' in txt or "import * as Tone" in txt:
        dim(f"  {f.relative_to(ROOT)}")

# ── SCAN 8: App.tsx routing ──────────────────────────────────────
sec("SCAN 8 — APP.TSX ROUTING")
app_tsx = ROOT / "client" / "src" / "App.tsx"
if app_tsx.exists():
    log("App.tsx:")
    for i, ln in enumerate(app_tsx.read_text().splitlines(), 1):
        print(f"{DIM}  {i:3d}  {ln}{RST}")
