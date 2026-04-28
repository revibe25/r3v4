#!/usr/bin/env python3
"""
fix-worklet-decl-v2.py — R3 v4
================================
Fixes two type mismatches in worklet-types/audio-worklet-global.d.ts
introduced by the previous patch.  No source file changes.

Error 1 TS2352 — processorOptions cast fails
  Root cause: declared as Record<string, unknown>, lib.dom uses `any`.
  Fix: processorOptions?: any

Error 2 TS2345 — registerProcessor constructor arity conflict
  Root cause: optional options in our decl vs required in VSTProcessor,
              and no-arg constructors in RecorderWorklet/InstrumentProcessor.
  Fix: new (...args: any[]) => AudioWorkletProcessor
       (accepts any arity; return type still enforced)
"""

import os
import shutil
import sys

DECL_FILE = os.path.expanduser(
    "~/Stable/client/worklet-types/audio-worklet-global.d.ts"
)

# ── Pre-flight ────────────────────────────────────────────────────────────────

if not os.path.isfile(DECL_FILE):
    print(f"[FATAL] {DECL_FILE} not found", file=sys.stderr)
    sys.exit(1)

with open(DECL_FILE, "r", encoding="utf-8") as f:
    original = f.read()

print(f"[OK]    Read {DECL_FILE}")

# ── Define the two targeted replacements ─────────────────────────────────────

OLD_PROCESSOR_OPTIONS = "  processorOptions?: Record<string, unknown>;"
NEW_PROCESSOR_OPTIONS = "  processorOptions?: any;  // matches Web Audio API spec (lib.dom uses any)"

OLD_REGISTER = (
    "  processorCtor: (new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor) & {"
)
NEW_REGISTER = (
    "  processorCtor: (new (...args: any[]) => AudioWorkletProcessor) & {"
    "  // any arity: required, optional, or no-arg constructors all valid"
)

# ── Verify both targets exist before writing ──────────────────────────────────

missing = []
if OLD_PROCESSOR_OPTIONS not in original:
    missing.append("processorOptions line not found — already patched or file changed")
if OLD_REGISTER not in original:
    missing.append("registerProcessor ctor line not found — already patched or file changed")

if missing:
    for m in missing:
        print(f"[WARN]  {m}", file=sys.stderr)
    # Check if already correct
    already_any      = "processorOptions?: any;" in original
    already_any_args = "new (...args: any[])" in original
    if already_any and already_any_args:
        print("[OK]    File already has correct declarations — nothing to do.")
        sys.exit(0)
    print("[FATAL] Cannot locate patch targets and file is not already correct. Inspect manually.", file=sys.stderr)
    sys.exit(1)

# ── Backup ────────────────────────────────────────────────────────────────────

bak = DECL_FILE + ".v1bak"
shutil.copy2(DECL_FILE, bak)
print(f"[OK]    Backup: {bak}")

def rollback():
    shutil.copy2(bak, DECL_FILE)
    print(f"[ROLLBACK] Restored {DECL_FILE}", file=sys.stderr)

# ── Apply both patches ────────────────────────────────────────────────────────

patched = original.replace(OLD_PROCESSOR_OPTIONS, NEW_PROCESSOR_OPTIONS, 1)
patched = patched.replace(OLD_REGISTER, NEW_REGISTER, 1)

# ── Post-patch assertions ─────────────────────────────────────────────────────

assertions = [
    ("processorOptions?: any;" in patched,
     "processorOptions fix not applied"),
    ("Record<string, unknown>" not in patched,
     "Record<string, unknown> still present"),
    ("new (...args: any[])" in patched,
     "any-args constructor fix not applied"),
    ("new (options?: AudioWorkletNodeOptions)" not in patched,
     "old optional-options ctor still present"),
    ("AudioWorkletProcessor" in patched,
     "AudioWorkletProcessor declaration missing"),
    ("registerProcessor" in patched,
     "registerProcessor declaration missing"),
    ("sampleRate" in patched,
     "sampleRate declaration missing"),
    ("currentTime" in patched,
     "currentTime declaration missing"),
    ("currentFrame" in patched,
     "currentFrame declaration missing"),
    ("MessagePort" in patched,
     "MessagePort reference missing"),
]

for condition, message in assertions:
    if not condition:
        rollback()
        print(f"[FATAL] Assertion failed: {message}", file=sys.stderr)
        sys.exit(1)

print("[OK]    All assertions passed")

# ── Write ─────────────────────────────────────────────────────────────────────

try:
    with open(DECL_FILE, "w", encoding="utf-8") as f:
        f.write(patched)
    print(f"[OK]    Written: {DECL_FILE}")
except OSError as e:
    rollback()
    print(f"[FATAL] Write failed: {e}", file=sys.stderr)
    sys.exit(1)

# Read-back verify
with open(DECL_FILE, "r", encoding="utf-8") as f:
    verify = f.read()

if "processorOptions?: any;" not in verify or "new (...args: any[])" not in verify:
    rollback()
    print("[FATAL] Read-back verify failed", file=sys.stderr)
    sys.exit(1)

print("[OK]    Read-back verify passed")
print()
print("[DONE]  Two declaration mismatches fixed.")
print()
print("Validate:")
print("  cd ~/Stable/client")
print("  tsc --noEmit -p tsconfig.worklet.json   # target: 0 errors")
print("  tsc --noEmit -p tsconfig.node.json      # must still be 0 errors")
print("  tsc --noEmit                             # must still be 0 errors")
