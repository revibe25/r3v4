#!/usr/bin/env python3
"""
R3 Native v2.0.0 — TypeScript Error Fixes
3 targeted surgical fixes, read-before-write on all files.
"""
import os
import sys

SRC    = os.path.expanduser("~/Stable/client/src")
SERVER = os.path.expanduser("~/Stable/server")

PASS = 0
FAIL = 0

def ok(msg):  global PASS; PASS += 1; print(f"✅ {msg}")
def err(msg): global FAIL; FAIL += 1; print(f"❌ {msg}")
def info(msg): print(f"ℹ  {msg}")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1: DrumWorkstation.tsx — duplicate boxShadow property (TS1117)
# Line 390 is the simpler duplicate; line 392 is correct (handles step highlight)
# ─────────────────────────────────────────────────────────────────────────────
info("Fix 1: DrumWorkstation.tsx duplicate boxShadow...")

drum = f"{SRC}/components/drum/DrumWorkstation.tsx"
with open(drum) as f:
    content = f.read()

# Match the exact duplicated line sitting between borderColor and borderTopColor
OLD = (
    "                boxShadow: on ? '0 0 5px rgba(200,255,0,0.12)' : 'none',\n"
    "                borderTopColor: i % 4 === 0 ? '#444' : undefined,\n"
    "                boxShadow: stepIndex"
)
NEW = (
    "                borderTopColor: i % 4 === 0 ? '#444' : undefined,\n"
    "                boxShadow: stepIndex"
)

if OLD in content:
    fixed = content.replace(OLD, NEW, 1)
    with open(drum, "w") as f:
        f.write(fixed)
    ok("DrumWorkstation.tsx: duplicate boxShadow removed (kept step-highlight version)")
else:
    err("DrumWorkstation.tsx: pattern not found — check line 390 manually")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: StudioHeader.tsx — react-router-dom → wouter (TS2307)
# Project uses wouter (confirmed in instrument.tsx line 28)
# ─────────────────────────────────────────────────────────────────────────────
info("Fix 2: StudioHeader.tsx react-router-dom → wouter...")

header = f"{SRC}/components/studio/StudioHeader.tsx"
with open(header) as f:
    content = f.read()

OLD2 = "import { Link } from 'react-router-dom';"
NEW2 = "import { Link } from 'wouter';"

if OLD2 in content:
    fixed = content.replace(OLD2, NEW2, 1)
    with open(header, "w") as f:
        f.write(fixed)
    ok("StudioHeader.tsx: react-router-dom → wouter")
elif "from 'wouter'" in content:
    ok("StudioHeader.tsx: wouter already imported (no change needed)")
else:
    err("StudioHeader.tsx: unexpected import pattern — check line 6 manually")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: server/middleware/auth.ts + trpc.ts — req.user type (TS2339)
# Creates Express type augmentation so req.user resolves correctly
# ─────────────────────────────────────────────────────────────────────────────
info("Fix 3: Express Request type augmentation for req.user...")

types_dir = os.path.join(SERVER, "types")
os.makedirs(types_dir, exist_ok=True)

express_d_ts = """\
// Express Request augmentation for Stable DAW auth middleware.
// Resolves TS2339: Property 'user' does not exist on type 'Request'
// Used by: server/middleware/auth.ts, server/trpc.ts

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email?: string | null;
        [key: string]: unknown;
      };
    }
  }
}

export {};
"""

out = os.path.join(types_dir, "express.d.ts")
with open(out, "w") as f:
    f.write(express_d_ts)
ok(f"Created: {out}")

# Verify server tsconfig picks up the types dir
server_tsconfig = os.path.join(SERVER, "tsconfig.json")
if os.path.exists(server_tsconfig):
    with open(server_tsconfig) as f:
        tsconfig = f.read()
    if '"types"' in tsconfig or '"include"' in tsconfig:
        info("server/tsconfig.json exists — verify 'types/**' is included")
    else:
        info("server/tsconfig.json exists — augmentation should auto-resolve")
else:
    info("No server/tsconfig.json found — using root tsconfig (should work)")

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
print()
print("─" * 60)
print(f"  Fixes applied: {PASS}    Failures: {FAIL}")
print("─" * 60)
if FAIL == 0:
    print("  All fixes applied. Run: npm run typecheck")
else:
    print("  Fix the ❌ items above manually, then run: npm run typecheck")
print()
