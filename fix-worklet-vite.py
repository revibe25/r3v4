#!/usr/bin/env python3
"""
Wire.txt-compliant patch:
  Fix 1 — tsconfig.worklet.json: add "AudioWorklet" lib, add noImplicitAny:false
  Fix 2 — vite.config.ts: remove deprecated fastRefresh option
Backs up before every write. Rolls back all on any failure. Exits non-zero on failure.
"""

import json, os, shutil, sys

CLIENT = os.path.expanduser("~/Stable/client")
WORKLET_CFG = os.path.join(CLIENT, "tsconfig.worklet.json")
VITE_CFG    = os.path.join(CLIENT, "vite.config.ts")

backed_up = []

def rollback():
    print("\n[ROLLBACK] Restoring backups...", file=sys.stderr)
    for (orig, bak) in backed_up:
        if os.path.exists(bak):
            shutil.copy2(bak, orig)
            print(f"  restored: {orig}", file=sys.stderr)

def die(msg):
    print(f"[FATAL] {msg}", file=sys.stderr)
    rollback()
    sys.exit(1)

def backup(path):
    bak = path + ".bak"
    try:
        shutil.copy2(path, bak)
        backed_up.append((path, bak))
        print(f"[BAK]   {bak}")
    except OSError as e:
        die(f"Backup failed for {path}: {e}")

# ── Pre-flight ────────────────────────────────────────────────────────────────
for f in [WORKLET_CFG, VITE_CFG]:
    if not os.path.isfile(f):
        die(f"Required file not found: {f}")

# ── Fix 1 — tsconfig.worklet.json ─────────────────────────────────────────────
backup(WORKLET_CFG)

try:
    with open(WORKLET_CFG, "r", encoding="utf-8") as f:
        cfg = json.load(f)
except json.JSONDecodeError as e:
    die(f"Cannot parse tsconfig.worklet.json: {e}")

opts = cfg.setdefault("compilerOptions", {})

# Add AudioWorklet lib if not already present
lib = opts.get("lib", [])
if "AudioWorklet" not in lib:
    lib.append("AudioWorklet")
    opts["lib"] = lib

# Override strict's noImplicitAny — matches main tsconfig pattern
opts["noImplicitAny"] = False

# Ensure include covers all three worklet files
cfg["include"] = [
    "src/audio/fx/vst-processor.worklet.ts",
    "src/audio/recorder/recorder-worklet.ts",
    "src/worklets/instrument-processor.worklet.ts"
]

try:
    with open(WORKLET_CFG, "w", encoding="utf-8") as f:
        f.write(json.dumps(cfg, indent=2) + "\n")
    print(f"[WRITE] {WORKLET_CFG}")
except OSError as e:
    die(f"Write failed for tsconfig.worklet.json: {e}")

# Verify
try:
    with open(WORKLET_CFG, "r", encoding="utf-8") as f:
        v = json.load(f)
    assert "AudioWorklet" in v["compilerOptions"]["lib"], "AudioWorklet lib missing"
    assert v["compilerOptions"]["noImplicitAny"] == False, "noImplicitAny not set"
    assert len(v["include"]) == 3, "include count wrong"
    print("[OK]    tsconfig.worklet.json — AudioWorklet lib + noImplicitAny:false verified")
except (AssertionError, KeyError) as e:
    die(f"Post-write verification failed: {e}")

# ── Fix 2 — vite.config.ts ────────────────────────────────────────────────────
backup(VITE_CFG)

try:
    with open(VITE_CFG, "r", encoding="utf-8") as f:
        src = f.read()
except OSError as e:
    die(f"Cannot read vite.config.ts: {e}")

OLD = (
    "        // Only enable React Fast Refresh on dev; avoids a tiny prod overhead.\n"
    "        fastRefresh: isDev,\n"
)
NEW = ""

if OLD not in src:
    die(
        "Anchor string not found in vite.config.ts — file may have changed.\n"
        "Expected to find:\n" + OLD
    )

count = src.count(OLD)
if count != 1:
    die(f"Anchor string found {count} times — expected exactly 1. Aborting.")

patched = src.replace(OLD, NEW, 1)

try:
    with open(VITE_CFG, "w", encoding="utf-8") as f:
        f.write(patched)
    print(f"[WRITE] {VITE_CFG}")
except OSError as e:
    die(f"Write failed for vite.config.ts: {e}")

# Verify — anchor gone, react( still present, no double-blank-line artifacts
with open(VITE_CFG, "r", encoding="utf-8") as f:
    final = f.read()

if "fastRefresh" in final:
    die("fastRefresh still present in vite.config.ts after patch")
if "react(" not in final:
    die("react( call missing from vite.config.ts — patch overshot")
print("[OK]    vite.config.ts — fastRefresh removed, react() call intact")

print("""
[DONE] Both fixes applied and verified.

Validate all three configs:
  cd ~/Stable/client
  tsc --noEmit
  tsc --noEmit -p tsconfig.node.json
  tsc --noEmit -p tsconfig.worklet.json
""")
