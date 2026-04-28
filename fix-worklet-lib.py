#!/usr/bin/env python3
"""
fix-worklet-lib.py — R3 v4
===========================
Fixes tsconfig.worklet.json: removes the invalid "AudioWorklet" lib entry
that causes TypeScript to reject the entire lib array, taking down
AudioWorkletProcessor, registerProcessor, sampleRate, currentTime,
currentFrame, and .port with it.

Single targeted change:
  BEFORE: "lib": ["WebWorker", "ESNext", "AudioWorklet"]
  AFTER:  "lib": ["webworker", "ESNext"]

All other compilerOptions and include/exclude arrays are preserved exactly.

Run:   python3 fix-worklet-lib.py
Then:  cd ~/Stable/client
       tsc --noEmit -p tsconfig.worklet.json
       tsc --noEmit -p tsconfig.node.json
       tsc --noEmit
"""

import json
import os
import shutil
import sys

# ── Paths ─────────────────────────────────────────────────────────────────────

CLIENT_DIR   = os.path.expanduser("~/Stable/client")
WORKLET_CFG  = os.path.join(CLIENT_DIR, "tsconfig.worklet.json")
MAIN_CFG     = os.path.join(CLIENT_DIR, "tsconfig.json")
NODE_CFG     = os.path.join(CLIENT_DIR, "tsconfig.node.json")

# ── Helpers ───────────────────────────────────────────────────────────────────

def die(msg: str) -> None:
    print(f"[FATAL] {msg}", file=sys.stderr)
    sys.exit(1)

def ok(msg: str) -> None:
    print(f"[OK]    {msg}")

def info(msg: str) -> None:
    print(f"[INFO]  {msg}")

# ── Pre-flight: confirm all three tsconfigs exist ──────────────────────────────

for path, label in [
    (WORKLET_CFG, "tsconfig.worklet.json"),
    (MAIN_CFG,    "tsconfig.json"),
    (NODE_CFG,    "tsconfig.node.json"),
]:
    if not os.path.isfile(path):
        die(f"{label} not found at {path}")
    ok(f"Found {label}")

# ── Read tsconfig.worklet.json ─────────────────────────────────────────────────

try:
    with open(WORKLET_CFG, "r", encoding="utf-8") as f:
        raw = f.read()
    cfg = json.loads(raw)
except json.JSONDecodeError as e:
    die(f"Cannot parse tsconfig.worklet.json: {e}")

# ── Snapshot current lib for logging ──────────────────────────────────────────

opts = cfg.get("compilerOptions", {})
lib_before = list(opts.get("lib", []))
info(f"lib BEFORE: {lib_before}")

# ── Validate expectations ──────────────────────────────────────────────────────

INVALID_ENTRY  = "AudioWorklet"    # causes TS6046 — not a valid lib identifier
REQUIRED_LOWER = ["webworker", "esnext"]

invalid_found = any(e.lower() == INVALID_ENTRY.lower() for e in lib_before)
if not invalid_found:
    # Already fixed — nothing to do
    info("'AudioWorklet' not found in lib — tsconfig may already be correct.")
    webworker_present = any(e.lower() == "webworker" for e in lib_before)
    esnext_present    = any(e.lower() == "esnext"    for e in lib_before)
    if webworker_present and esnext_present:
        ok("lib is already correct: webworker + ESNext present, AudioWorklet absent.")
        sys.exit(0)
    else:
        die(
            f"Unexpected lib state: {lib_before}. "
            "Manual inspection required — not patching."
        )

# Confirm webworker is present (either casing) so we're not removing the only valid entry
webworker_present = any(e.lower() == "webworker" for e in lib_before)
if not webworker_present:
    die(
        f"'webworker' (or 'WebWorker') not found in lib before patch: {lib_before}. "
        "Patching would leave worklet files without AudioWorkletProcessor globals. "
        "Inspect tsconfig.worklet.json manually."
    )

# Confirm no "dom" (DOM must never be in a worklet tsconfig — it shadows globals)
dom_present = any(e.lower() in ("dom", "dom.iterable") for e in lib_before)
if dom_present:
    die(
        f"'dom' found in worklet lib: {lib_before}. "
        "DOM must never be in tsconfig.worklet.json — it conflicts with webworker globals."
    )

ok("Pre-flight passed — safe to patch")

# ── Backup ────────────────────────────────────────────────────────────────────

bak = WORKLET_CFG + ".bak"
try:
    shutil.copy2(WORKLET_CFG, bak)
    ok(f"Backup written: {bak}")
except OSError as e:
    die(f"Backup failed: {e}")

def rollback() -> None:
    try:
        shutil.copy2(bak, WORKLET_CFG)
        print(f"[ROLLBACK] Restored {WORKLET_CFG}", file=sys.stderr)
    except OSError as rb_err:
        print(f"[ROLLBACK FAILED] {rb_err}", file=sys.stderr)

# ── Apply patch ───────────────────────────────────────────────────────────────
#
# Strip "AudioWorklet" (any casing), normalize remaining entries:
#   "WebWorker" → "webworker"   (canonical lowercase per TS valid-lib list)
#   "ESNext"    → "ESNext"      (TS accepts mixed case; preserve as-is)
# Result: ["webworker", "ESNext"]

NORMALIZE_MAP = {
    "webworker": "webworker",   # enforce lowercase
    "esnext":    "ESNext",      # preserve conventional mixed case
}

new_lib: list[str] = []
for entry in lib_before:
    key = entry.lower()
    if key == INVALID_ENTRY.lower():
        info(f"Dropping invalid entry: \"{entry}\"")
        continue
    normalized = NORMALIZE_MAP.get(key, entry)
    new_lib.append(normalized)

# Guarantee both required entries are present after filtering
for required in ["webworker", "ESNext"]:
    if required not in new_lib and required.lower() not in [x.lower() for x in new_lib]:
        new_lib.append(required)

cfg["compilerOptions"]["lib"] = new_lib
info(f"lib AFTER:  {new_lib}")

# ── Post-patch assertions ──────────────────────────────────────────────────────

lib_after     = cfg["compilerOptions"]["lib"]
lib_after_low = [x.lower() for x in lib_after]

assertions = [
    (
        "audioworklet" not in lib_after_low,
        "FAIL: 'AudioWorklet' still present in lib"
    ),
    (
        "webworker" in lib_after_low,
        "FAIL: 'webworker' missing from lib — worklet globals will be undefined"
    ),
    (
        "esnext" in lib_after_low,
        "FAIL: 'ESNext' missing from lib"
    ),
    (
        "dom" not in lib_after_low,
        "FAIL: 'dom' must never appear in worklet lib"
    ),
    (
        cfg["compilerOptions"].get("target") == "ESNext",
        "FAIL: target changed unexpectedly"
    ),
    (
        cfg["compilerOptions"].get("isolatedModules") is True,
        "FAIL: isolatedModules changed unexpectedly"
    ),
    (
        isinstance(cfg.get("include"), list) and len(cfg["include"]) == 3,
        "FAIL: include array changed (expected 3 entries)"
    ),
]

for (condition, message) in assertions:
    if not condition:
        rollback()
        die(message)

ok("All assertions passed")

# ── Write ──────────────────────────────────────────────────────────────────────

try:
    with open(WORKLET_CFG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
        f.write("\n")
    ok(f"Written: {WORKLET_CFG}")
except OSError as e:
    rollback()
    die(f"Write failed: {e}")

# ── Final read-back verify ─────────────────────────────────────────────────────

try:
    with open(WORKLET_CFG, "r", encoding="utf-8") as f:
        verify = json.load(f)
    assert verify["compilerOptions"]["lib"] == new_lib, "Read-back lib mismatch"
    ok("Read-back verify passed")
except Exception as e:
    rollback()
    die(f"Read-back failed: {e}")

# ── Done ───────────────────────────────────────────────────────────────────────

print()
print("[DONE]  tsconfig.worklet.json patched successfully.")
print()
print("Next — run all three checks in order:")
print("  cd ~/Stable/client")
print("  tsc --noEmit -p tsconfig.worklet.json   # must be zero errors")
print("  tsc --noEmit -p tsconfig.node.json      # must be zero errors")
print("  tsc --noEmit                             # must be zero errors")
print()
print("Expected outcome: 0 errors across all three configs.")
print("All 24 worklet errors resolve from 'webworker' lib — no source file changes needed.")
