#!/usr/bin/env python3
import json, os, shutil, sys

WORKLET_CFG = os.path.expanduser("~/Stable/client/tsconfig.worklet.json")

if not os.path.isfile(WORKLET_CFG):
    print("[FATAL] tsconfig.worklet.json not found", file=sys.stderr)
    sys.exit(1)

bak = WORKLET_CFG + ".bak"
try:
    shutil.copy2(WORKLET_CFG, bak)
    print(f"[BAK]   {bak}")
except OSError as e:
    print(f"[FATAL] Backup failed: {e}", file=sys.stderr)
    sys.exit(1)

def rollback():
    shutil.copy2(bak, WORKLET_CFG)
    print(f"[ROLLBACK] Restored {WORKLET_CFG}", file=sys.stderr)

def die(msg):
    print(f"[FATAL] {msg}", file=sys.stderr)
    rollback()
    sys.exit(1)

try:
    with open(WORKLET_CFG, "r", encoding="utf-8") as f:
        cfg = json.load(f)
except json.JSONDecodeError as e:
    die(f"Cannot parse tsconfig.worklet.json: {e}")

opts = cfg.setdefault("compilerOptions", {})

lib = opts.get("lib", [])
for entry in ["WebWorker", "ESNext", "AudioWorklet"]:
    if entry not in lib:
        lib.append(entry)
opts["lib"] = lib

opts["target"]            = "ESNext"
opts["module"]            = "ESNext"
opts["moduleResolution"]  = "bundler"
opts["strict"]            = True
opts["skipLibCheck"]      = True
opts["noEmit"]            = True
opts["isolatedModules"]   = True
opts["noImplicitAny"]     = False

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
    die(f"Write failed: {e}")

try:
    with open(WORKLET_CFG, "r", encoding="utf-8") as f:
        v = json.load(f)
    assert "AudioWorklet" in v["compilerOptions"]["lib"],   "AudioWorklet missing from lib"
    assert "WebWorker"    in v["compilerOptions"]["lib"],   "WebWorker missing from lib"
    assert v["compilerOptions"]["noImplicitAny"] == False,  "noImplicitAny not false"
    assert v["compilerOptions"]["isolatedModules"] == True, "isolatedModules not true"
    assert len(v["include"]) == 3,                          "include count != 3"
    print("[OK]    tsconfig.worklet.json verified — all assertions passed")
except (AssertionError, KeyError) as e:
    die(f"Post-write verification failed: {e}")

print("""
[DONE]

Now validate:
  cd ~/Stable/client
  tsc --noEmit
  tsc --noEmit -p tsconfig.node.json
  tsc --noEmit -p tsconfig.worklet.json
""")
