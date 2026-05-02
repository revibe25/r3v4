#!/usr/bin/env python3
"""
relocate_dsp.py — Move client/DSP_*.ts → client/DSP/*.ts
- Strips DSP_ prefix and _Version2 suffix from filenames
- Fixes GainComputer missing LDE import
- Verifies import resolution after move
- DRY_RUN=1 to preview
"""

import os, re, shutil, sys

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT = os.path.join(REPO_ROOT, "client")
DSP_SRC = CLIENT                      # where files currently live
DSP_DST = os.path.join(CLIENT, "DSP") # target

# Map: current filename → target filename (inside client/DSP/)
FILE_MAP = {
    "DSP_Core.ts":                  "Core.ts",
    "DSP_MSL.ts":                   "MSL.ts",
    "DSP_LDE.ts":                   "LDE.ts",
    "DSP_Smoother.ts":              "Smoother.ts",
    "DSP_GainComputer.ts":          "GainComputer.ts",
    "DSP_FFTAnalyzer.ts":           "FFTAnalyzer.ts",
    "DSP_PitchDetector.ts":         "PitchDetector.ts",
    "DSP_DynamicEQ_Version2.ts":    "DynamicEQ.ts",
    "DSP_DeEsser_Version2.ts":      "DeEsser.ts",
}

# Patch: fix GainComputer — add missing LDE import + make it a member
GAINCOMPUTER_PATCH = {
    "find":    'import { MSL } from \'./MSL\';',
    "replace": 'import { MSL } from \'./MSL\';\nimport { LDE } from \'./LDE\';',
}
GAINCOMPUTER_MEMBER_FIND = (
    "  private config: GainComputerConfig;\n"
    "  private currentGainDb = 0;\n"
    "  constructor(config: GainComputerConfig) {\n"
    "    this.config = config;\n"
    "  }"
)
GAINCOMPUTER_MEMBER_REPLACE = (
    "  private config: GainComputerConfig;\n"
    "  private currentGainDb = 0;\n"
    "  private lde: LDE;\n"
    "  constructor(config: GainComputerConfig, sampleRate = 48000) {\n"
    "    this.config = config;\n"
    "    this.lde = new LDE(sampleRate, 'hybrid');\n"
    "  }"
)
GAINCOMPUTER_APPLY_FIND    = "    // 1. Compute level\n    const lde = new LDE(48000, 'hybrid');\n    const detectedDb = lde.process(block);"
GAINCOMPUTER_APPLY_REPLACE = "    // 1. Compute level\n    const detectedDb = this.lde.process(block);"

def log(msg):
    prefix = "[DRY RUN] " if DRY_RUN else ""
    print(prefix + msg)

def patch_file(path, find, replace):
    with open(path) as f:
        src = f.read()
    if find not in src:
        print(f"  WARNING: patch target not found in {path}")
        return
    patched = src.replace(find, replace, 1)
    if not DRY_RUN:
        with open(path, "w") as f:
            f.write(patched)
    log(f"  Patched: {os.path.basename(path)}")

# Pre-flight
missing = [f for f in FILE_MAP if not os.path.exists(os.path.join(DSP_SRC, f))]
if missing:
    print("ABORT — source files not found:")
    for m in missing: print(f"  {m}")
    sys.exit(1)

# Create target dir
if not DRY_RUN:
    os.makedirs(DSP_DST, exist_ok=True)
else:
    log(f"mkdir {DSP_DST}")

# Move files
for src_name, dst_name in FILE_MAP.items():
    src_path = os.path.join(DSP_SRC, src_name)
    dst_path = os.path.join(DSP_DST, dst_name)
    log(f"mv {src_path} → {dst_path}")
    if not DRY_RUN:
        shutil.copy2(src_path, dst_path)

# Apply GainComputer patches (on the destination file)
gc_path = os.path.join(DSP_DST, "GainComputer.ts")
if not DRY_RUN:
    log("Patching GainComputer.ts...")
    patch_file(gc_path, GAINCOMPUTER_PATCH["find"], GAINCOMPUTER_PATCH["replace"])
    patch_file(gc_path, GAINCOMPUTER_MEMBER_FIND, GAINCOMPUTER_MEMBER_REPLACE)
    patch_file(gc_path, GAINCOMPUTER_APPLY_FIND, GAINCOMPUTER_APPLY_REPLACE)

# Verify import resolution — every import in Core.ts should resolve to a file in DSP_DST
core_path = os.path.join(DSP_DST, "Core.ts")
if not DRY_RUN and os.path.exists(core_path):
    with open(core_path) as f:
        core_src = f.read()
    imports = re.findall(r"from '\./([^']+)'", core_src)
    log("\nImport resolution check (Core.ts):")
    all_ok = True
    for imp in imports:
        target = os.path.join(DSP_DST, imp + ".ts")
        exists = os.path.exists(target)
        status = "✓" if exists else "✗ MISSING"
        log(f"  ./{imp} → {status}")
        if not exists: all_ok = False
    if not all_ok:
        print("\nERROR: unresolved imports after relocation — check manually")
        sys.exit(1)

# Remove originals only after successful copy + verify
if not DRY_RUN:
    for src_name in FILE_MAP:
        os.remove(os.path.join(DSP_SRC, src_name))
    log("\n✓ Originals removed")

log("\n✓ Relocation complete")
log(f"  Files in {DSP_DST}:")
if not DRY_RUN:
    for f in sorted(os.listdir(DSP_DST)):
        log(f"    {f}")
