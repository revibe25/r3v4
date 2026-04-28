#!/usr/bin/env python3
"""
fix-worklet-ts6.py — R3 v4
============================
TypeScript 6 removed AudioWorkletProcessor (and related globals) from
lib.webworker, placing them only in lib.dom. Since worklet files must never
see DOM, the fix is a scoped ambient declaration file that restores exactly
the globals the three worklet files need.

Changes made:
  CREATE client/worklet-types/audio-worklet-global.d.ts
    — Declares: AudioWorkletProcessor, AudioWorkletNodeOptions,
                AudioParamDescriptor, registerProcessor,
                sampleRate, currentTime, currentFrame
  PATCH  client/tsconfig.worklet.json
    — Adds "worklet-types" to the include array

NOT changed:
  client/tsconfig.json        (main compilation — unchanged, worklet-types
                               not under src/ or config/ so it stays invisible)
  client/tsconfig.node.json   (unchanged)
  Any source .ts/.tsx files   (zero source changes)

Run:   python3 fix-worklet-ts6.py
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
TYPES_DIR    = os.path.join(CLIENT_DIR, "worklet-types")
DECL_FILE    = os.path.join(TYPES_DIR, "audio-worklet-global.d.ts")

# ── Ambient declaration content ───────────────────────────────────────────────
#
# TypeScript 6 broke AudioWorkletProcessor out of lib.webworker. These
# declarations restore the AudioWorklet global scope without pulling in DOM.
#
# Scope:
#   AudioParamDescriptor      — static parameterDescriptors shape
#   AudioWorkletNodeOptions   — options passed to AudioWorkletProcessor ctor
#   AudioWorkletProcessor     — base class (port: MessagePort, process())
#   registerProcessor()       — global registration function
#   sampleRate                — AudioWorkletGlobalScope global (number)
#   currentTime               — AudioWorkletGlobalScope global (number)
#   currentFrame              — AudioWorkletGlobalScope global (number)
#
# MessagePort and Float32Array come from lib.webworker and lib.ESNext
# respectively — no conflict.
#
# This file is included ONLY via tsconfig.worklet.json. The main tsconfig.json
# includes "src" and "config" — worklet-types/ is outside both, so it is never
# visible to the main compilation and cannot conflict with lib.dom declarations.

DECL_CONTENT = """\
// worklet-types/audio-worklet-global.d.ts
//
// Ambient declarations for the AudioWorklet processor global scope.
//
// TypeScript 6 removed AudioWorkletProcessor and related globals from
// lib.webworker, placing them only in lib.dom. Worklet files must NOT use
// lib.dom (DOM APIs are unavailable in the audio thread). This file restores
// exactly the globals required by the three R3 v4 worklet processors.
//
// Included via tsconfig.worklet.json only — invisible to the main tsconfig
// (which uses lib.dom via lib: ["DOM", "DOM.Iterable", "ESNext"]).
// Prevents duplicate-identifier conflicts with lib.dom.d.ts at the cost of
// zero source-file changes.

// ─── Static parameter descriptor shape ───────────────────────────────────────

interface AudioParamDescriptor {
  name: string;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  automationRate?: 'a-rate' | 'k-rate';
}

// ─── AudioWorkletNode constructor options ─────────────────────────────────────
// Passed through to AudioWorkletProcessor constructor as options.processorOptions

interface AudioWorkletNodeOptions {
  numberOfInputs?: number;
  numberOfOutputs?: number;
  outputChannelCount?: number[];
  parameterData?: Record<string, number>;
  processorOptions?: Record<string, unknown>;
  channelCount?: number;
  channelCountMode?: 'max' | 'clamped-max' | 'explicit';
  channelInterpretation?: 'speakers' | 'discrete';
}

// ─── AudioWorkletProcessor base class ────────────────────────────────────────
// MessagePort is declared in lib.webworker — no re-declaration needed.

declare abstract class AudioWorkletProcessor {
  /** Communication channel between the processor and the AudioWorkletNode. */
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
  /**
   * Called by the audio engine to process a block of audio.
   * Return true to keep the processor alive; false to allow it to be collected.
   */
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

// ─── AudioWorklet global scope ────────────────────────────────────────────────

/**
 * Registers a class derived from AudioWorkletProcessor under the given name
 * so it can be instantiated via `new AudioWorkletNode(ctx, name)`.
 */
declare function registerProcessor(
  name: string,
  processorCtor: (new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor) & {
    parameterDescriptors?: ReadonlyArray<AudioParamDescriptor>;
  },
): void;

/** Current sample rate of the audio context (AudioWorkletGlobalScope global). */
declare const sampleRate: number;

/** Current playback time in seconds (AudioWorkletGlobalScope global). */
declare const currentTime: number;

/** Current sample frame index (AudioWorkletGlobalScope global). */
declare const currentFrame: number;
"""

# ── Helpers ───────────────────────────────────────────────────────────────────

def die(msg: str) -> None:
    print(f"[FATAL] {msg}", file=sys.stderr)
    sys.exit(1)

def ok(msg: str) -> None:
    print(f"[OK]    {msg}")

def info(msg: str) -> None:
    print(f"[INFO]  {msg}")

# ── Pre-flight ────────────────────────────────────────────────────────────────

for path, label in [
    (WORKLET_CFG, "tsconfig.worklet.json"),
    (MAIN_CFG,    "tsconfig.json"),
    (NODE_CFG,    "tsconfig.node.json"),
]:
    if not os.path.isfile(path):
        die(f"{label} not found at {path}")
    ok(f"Found {label}")

# Confirm main tsconfig does NOT include worklet-types (safety check)
try:
    with open(MAIN_CFG, "r", encoding="utf-8") as f:
        main_cfg = json.load(f)
    main_include = main_cfg.get("include", [])
    main_exclude = main_cfg.get("exclude", [])
    if any("worklet-types" in s for s in main_include):
        die("tsconfig.json already includes worklet-types — would cause duplicate identifier conflicts with lib.dom. Inspect manually.")
    ok("tsconfig.json does not include worklet-types — safe")
except json.JSONDecodeError as e:
    die(f"Cannot parse tsconfig.json: {e}")

# Read tsconfig.worklet.json
try:
    with open(WORKLET_CFG, "r", encoding="utf-8") as f:
        wcfg = json.load(f)
except json.JSONDecodeError as e:
    die(f"Cannot parse tsconfig.worklet.json: {e}")

current_include = wcfg.get("include", [])
info(f"tsconfig.worklet.json include BEFORE: {current_include}")

if "worklet-types" in current_include:
    info("'worklet-types' already in include — checking if declaration file exists")
    if os.path.isfile(DECL_FILE):
        ok("Declaration file already exists — nothing to do. Run tsc to verify.")
        sys.exit(0)
    else:
        info("include entry present but declaration file missing — will create it")

# ── Backup tsconfig.worklet.json ──────────────────────────────────────────────

bak = WORKLET_CFG + ".ts6bak"
try:
    shutil.copy2(WORKLET_CFG, bak)
    ok(f"Backup: {bak}")
except OSError as e:
    die(f"Backup failed: {e}")

def rollback() -> None:
    try:
        shutil.copy2(bak, WORKLET_CFG)
        print(f"[ROLLBACK] Restored {WORKLET_CFG}", file=sys.stderr)
        if os.path.isfile(DECL_FILE):
            os.remove(DECL_FILE)
            print(f"[ROLLBACK] Removed {DECL_FILE}", file=sys.stderr)
    except OSError as e:
        print(f"[ROLLBACK FAILED] {e}", file=sys.stderr)

# ── Create worklet-types/ directory ──────────────────────────────────────────

try:
    os.makedirs(TYPES_DIR, exist_ok=True)
    ok(f"Directory ready: {TYPES_DIR}")
except OSError as e:
    die(f"Cannot create {TYPES_DIR}: {e}")

# ── Write declaration file ────────────────────────────────────────────────────

try:
    with open(DECL_FILE, "w", encoding="utf-8") as f:
        f.write(DECL_CONTENT)
    ok(f"Written: {DECL_FILE}")
except OSError as e:
    rollback()
    die(f"Cannot write declaration file: {e}")

# Verify it was written correctly
try:
    with open(DECL_FILE, "r", encoding="utf-8") as f:
        written = f.read()
    assert "AudioWorkletProcessor" in written, "AudioWorkletProcessor missing from decl file"
    assert "registerProcessor"     in written, "registerProcessor missing from decl file"
    assert "sampleRate"            in written, "sampleRate missing from decl file"
    assert "currentTime"           in written, "currentTime missing from decl file"
    assert "currentFrame"          in written, "currentFrame missing from decl file"
    assert "MessagePort"           in written, "MessagePort missing from decl file"
    ok("Declaration file content verified")
except AssertionError as e:
    rollback()
    die(f"Declaration file verification failed: {e}")

# ── Patch tsconfig.worklet.json include ───────────────────────────────────────

new_include = list(current_include)
if "worklet-types" not in new_include:
    new_include.append("worklet-types")

wcfg["include"] = new_include

# Post-patch assertions on tsconfig
lib_after     = wcfg.get("compilerOptions", {}).get("lib", [])
lib_after_low = [x.lower() for x in lib_after]

assertions = [
    ("worklet-types" in wcfg["include"],
     "worklet-types missing from include after patch"),
    ("audioworklet" not in lib_after_low,
     "'AudioWorklet' lib entry still present — must be removed"),
    ("webworker" in lib_after_low,
     "'webworker' missing from lib"),
    ("dom" not in lib_after_low,
     "'dom' must never be in worklet lib"),
    (wcfg.get("compilerOptions", {}).get("isolatedModules") is True,
     "isolatedModules changed unexpectedly"),
]

for condition, message in assertions:
    if not condition:
        rollback()
        die(f"Assertion failed: {message}")

ok("All tsconfig assertions passed")

# ── Write patched tsconfig.worklet.json ───────────────────────────────────────

try:
    with open(WORKLET_CFG, "w", encoding="utf-8") as f:
        json.dump(wcfg, f, indent=2)
        f.write("\n")
    ok(f"Written: {WORKLET_CFG}")
except OSError as e:
    rollback()
    die(f"Write failed: {e}")

# Read-back verify
try:
    with open(WORKLET_CFG, "r", encoding="utf-8") as f:
        verify = json.load(f)
    assert "worklet-types" in verify["include"], "Read-back: worklet-types not in include"
    ok("Read-back verify passed")
except Exception as e:
    rollback()
    die(f"Read-back failed: {e}")

info(f"tsconfig.worklet.json include AFTER: {verify['include']}")

# ── Done ──────────────────────────────────────────────────────────────────────

print()
print("[DONE]")
print()
print("Files written:")
print(f"  {DECL_FILE}")
print(f"  {WORKLET_CFG}")
print()
print("Validate now — run all three in order:")
print("  cd ~/Stable/client")
print("  tsc --noEmit -p tsconfig.worklet.json   # target: 0 errors")
print("  tsc --noEmit -p tsconfig.node.json      # must still be 0 errors")
print("  tsc --noEmit                             # must still be 0 errors")
print()
print("Expected: 0 errors across all three. No source file changes were made.")
