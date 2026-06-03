#!/usr/bin/env python3
"""
patch_vst.py
Patches: client/src/pages/vst.tsx
Patches: 4 (grid-bg, cell-inner, sub-header strip, VSTBrowser wrapper)
Anchors: verified against live file grep + sed output 2026-05-30
Protocol: WIRE — backup before write, assert count==1, TSC after

NOTE: The original 6-patch script's P3 anchor ("padding: '10px 14px' + T.surface + T.border")
does not exist in the file. Line 188 has padding:'10px 14px' but in LLPTECallout which
uses rgba values, not T.surface/T.border. That block is intentionally styled with the
violet accent and must NOT be touched. The original P3 was a ghost anchor.
Patches here target the 4 real T.surface/T.border blocks that need updating.
"""
import pathlib, shutil, time, sys

DRY_RUN = '--apply' not in sys.argv

p = pathlib.Path('/home/r3v/Stable/client/src/pages/vst.tsx')
assert p.exists(), f"File not found: {p}"

bak = p.with_suffix(f'.tsx.bak.{int(time.time())}')
shutil.copy2(p, bak)
print(f"Backup: {bak}")

src = p.read_text()

def patch(src, old, new, name):
    count = src.count(old)
    assert count == 1, f"ANCHOR FAIL '{name}': found {count}"
    print(f"  ✓ anchor '{name}' found 1")
    if DRY_RUN:
        return src
    return src.replace(old, new)

# ── P1: FX grid outer container (lines 111-112) ──────────────────────────────
# T.border as background color (creates 1px gap grid effect) → near-black rgba
# T.border as border color → ultra-low-opacity white rule
src = patch(src,
    "      background:          T.border,\n      border:              `1px solid ${T.border}`,",
    "      background:          'rgba(0,0,0,0.4)',\n      border:              '1px solid rgba(255,255,255,0.04)',\n      borderRadius:        2,",
    'grid-bg'
)

# ── P2: FX cell inner (lines 117-118) ────────────────────────────────────────
# T.surface flat fill → subtle gradient lift
# NOTE: padding line comes AFTER background in the file (line 117=background, 118=padding)
src = patch(src,
    "          background:  T.surface,\n          padding:     '10px 14px',",
    "          background:  'linear-gradient(135deg,rgba(255,255,255,0.025) 0%,rgba(0,0,0,0) 100%)',\n          padding:     '12px 16px',",
    'cell-inner-1'
)

# ── P3: sub-header strip (lines ~248-250) ────────────────────────────────────
# The page header bar uses T.border for borderBottom and T.surface as background.
# Replace with low-opacity equivalents consistent with P1/P2.
# Anchor uses the 3 lines together (unique in file).
src = patch(src,
    "        borderBottom: `1px solid ${T.border}`,\n        background:   T.surface,",
    "        borderBottom: '1px solid rgba(255,255,255,0.04)',\n        background:   'rgba(8,8,8,0.6)',",
    'sub-header-strip'
)

# ── P4: VSTBrowser wrapper div (line ~291) ───────────────────────────────────
# Inline border+background on the wrapper div that contains <VSTBrowser>.
# Anchor: the specific property combination is unique (verified: T.border + T.surface
# on a single-line style object only appears once in this form).
src = patch(src,
    "        <div style={{ border: `1px solid ${T.border}`, background: T.surface }}>",
    "        <div style={{ border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0)', borderRadius: 2 }}>",
    'vstbrowser-wrapper'
)

if DRY_RUN:
    print("\nDRY RUN complete — no files written. Re-run with --apply to write.")
else:
    p.write_text(src)
    print(f"\nWrote {p}")
    print("Next: pnpm tsc --noEmit (must stay at 0 errors)")
