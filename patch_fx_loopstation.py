#!/usr/bin/env python3
"""
LoopStation505 FX wiring patch
────────────────────────────────────────────────────────────────────────────────
Fixes applied:
  1. Add 6 missing useState declarations (preDly, granDensity, granSpread,
     eqLF, eqHMF, eqHF)
  2. PRE-DLY: remove stale TODO, bind preDly state, method exists at engine:2044
  3. DENSITY knob: was calling setGranularSpread → fix to setGranularDensity
  4. SPREAD knob:  was calling setGranularDensity → fix to setGranularSpread
  5. Both granular knobs: bind state vars so position persists across re-renders
  6. MASTER EQ LF/HMF/HF: wire to setMultibandBand (threshold=0, ratio=1 →
     pure gain shelf, gainDb = (v-0.5)*24 → ±12 dB, engine clamps to [-12,12])
  7. MASTER EQ SUB: stays noop — engine has no sub-shelf method; comment added
     (needs setSubShelf(gainDb) in loopEngine before this can be wired)

Usage:
  python3 patch_fx_loopstation.py           # dry-run: print diffs, touch nothing
  python3 patch_fx_loopstation.py --apply   # backup original, write patched file
────────────────────────────────────────────────────────────────────────────────
"""
import sys, shutil, pathlib, difflib

TARGET = pathlib.Path.home() / 'Stable/client/src/features/loopstation/LoopStation505.tsx'
BACKUP = TARGET.with_suffix('.tsx.bak')
DRY    = '--apply' not in sys.argv

# ─────────────────────────────────────────────────────────────────────────────

def apply_patch(src: str, old: str, new: str, label: str) -> str:
    count = src.count(old)
    if count == 0:
        print(f'\n[ERROR] {label}: anchor string not found in file')
        sys.exit(1)
    if count > 1:
        print(f'\n[ERROR] {label}: anchor matched {count} times — must be unique')
        sys.exit(1)
    result = src.replace(old, new, 1)
    diff = list(difflib.unified_diff(
        old.splitlines(keepends=True),
        new.splitlines(keepends=True),
        fromfile=f'a/{label}',
        tofile=f'b/{label}',
    ))
    print(f'\n{"─" * 72}')
    print(f'  {label}')
    print(f'{"─" * 72}')
    print(''.join(diff))
    return result

# ─────────────────────────────────────────────────────────────────────────────

src = TARGET.read_text(encoding='utf-8')

# ── PATCH 1: add 6 useState declarations ─────────────────────────────────────
src = apply_patch(src,
    label='PATCH 1 — add missing useState declarations',
    old='  const [rDecay,  setRDec]  = useState(0.35);',
    new=(
        '  const [rDecay,  setRDec]  = useState(0.35);\n'
        '  const [preDly,      setPreDly]      = useState(0.1);   // reverb pre-delay  (0‥1 → 0‥0.5 s)\n'
        '  const [granDensity, setGranDensity] = useState(0.5);   // granular density  (normalised)\n'
        '  const [granSpread,  setGranSpread]  = useState(0.3);   // granular spread   (normalised)\n'
        '  const [eqLF,        setEqLF]        = useState(0.5);   // master EQ low     (bipolar → ±12 dB)\n'
        '  const [eqHMF,       setEqHMF]       = useState(0.5);   // master EQ mid     (bipolar → ±12 dB)\n'
        '  const [eqHF,        setEqHF]        = useState(0.5);   // master EQ high    (bipolar → ±12 dB)'
    ),
)

# ── PATCH 2: PRE-DLY — remove stale TODO, bind preDly state ─────────────────
src = apply_patch(src,
    label='PATCH 2 — PRE-DLY: remove TODO, wire state (method exists at engine:2044)',
    old=(
        '                  <FXKnob label="PRE-DLY" value={0.1}    color={T.orange} size="sm"'
        ' onChange={v => { /* TODO: Reverb PRE-DLY engine method not found —'
        ' implement setReverbPreDelay in loopEngine */'
        ' if (getLoopEngine().initialized) getLoopEngine().setReverbPreDelay(v * 0.5); }} />'
    ),
    new=(
        '                  <FXKnob label="PRE-DLY" value={preDly} color={T.orange} size="sm"'
        ' onChange={v => { setPreDly(v); if (getLoopEngine().initialized) getLoopEngine().setReverbPreDelay(v * 0.5); }} />'
    ),
)

# ── PATCH 3: DENSITY/SPREAD — fix handler swap + bind state vars ─────────────
src = apply_patch(src,
    label='PATCH 3 — GRANULAR: fix DENSITY/SPREAD handler swap, bind state vars',
    old=(
        '                  <FXKnob label="DENSITY" value={0.5}  color={T.teal} size="sm"'
        ' onChange={v => { /* TODO: Granular SPREAD engine method not found —'
        ' implement setGranularSpread in loopEngine */'
        ' if (getLoopEngine().initialized) getLoopEngine().setGranularSpread(v); }} />\n'
        '                  <FXKnob label="SPREAD"  value={0.3}  color={T.teal} size="sm"'
        ' onChange={v => { /* TODO: Granular DENSITY engine method not found —'
        ' implement setGranularDensity in loopEngine */'
        ' if (getLoopEngine().initialized) getLoopEngine().setGranularDensity(v); }} />'
    ),
    new=(
        '                  <FXKnob label="DENSITY" value={granDensity} color={T.teal} size="sm"'
        ' onChange={v => { setGranDensity(v); if (getLoopEngine().initialized) getLoopEngine().setGranularDensity(v); }} />\n'
        '                  <FXKnob label="SPREAD"  value={granSpread}  color={T.teal} size="sm"'
        ' onChange={v => { setGranSpread(v);  if (getLoopEngine().initialized) getLoopEngine().setGranularSpread(v);  }} />'
    ),
)

# ── PATCH 4: MASTER EQ — wire LF/HMF/HF; SUB stays noop with clear comment ──
# setMultibandBand(band, threshold=0, ratio=1, gainDb) → unity compressor = pure gain shelf
# (v - 0.5) * 24  →  ±12 dB  (engine clamps to [-12, 12])
src = apply_patch(src,
    label='PATCH 4 — MASTER EQ: wire LF/HMF/HF; SUB noop with engine gap comment',
    old=(
        '                  <FXKnob label="SUB"  value={0.5} color={T.cyan} size="sm" bipolar onChange={() => {}} />\n'
        '                  <FXKnob label="LF"   value={0.5} color={T.cyan} size="sm" bipolar onChange={() => {}} />\n'
        '                  <FXKnob label="HMF"  value={0.5} color={T.cyan} size="sm" bipolar onChange={() => {}} />\n'
        '                  <FXKnob label="HF"   value={0.5} color={T.cyan} size="sm" bipolar onChange={() => {}} />'
    ),
    new=(
        '                  {/* SUB: engine has no sub-shelf method — wire after adding setSubShelf(gainDb) to loopEngine */}\n'
        '                  <FXKnob label="SUB"  value={0.5}  color={T.cyan} size="sm" bipolar onChange={() => {}} />\n'
        '                  <FXKnob label="LF"   value={eqLF}  color={T.cyan} size="sm" bipolar'
        ' onChange={v => { setEqLF(v);  if (getLoopEngine().initialized) getLoopEngine().setMultibandBand(\'low\',  0, 1, (v - 0.5) * 24); }} />\n'
        '                  <FXKnob label="HMF"  value={eqHMF} color={T.cyan} size="sm" bipolar'
        ' onChange={v => { setEqHMF(v); if (getLoopEngine().initialized) getLoopEngine().setMultibandBand(\'mid\',  0, 1, (v - 0.5) * 24); }} />\n'
        '                  <FXKnob label="HF"   value={eqHF}  color={T.cyan} size="sm" bipolar'
        ' onChange={v => { setEqHF(v);  if (getLoopEngine().initialized) getLoopEngine().setMultibandBand(\'high\', 0, 1, (v - 0.5) * 24); }} />'
    ),
)

# ─────────────────────────────────────────────────────────────────────────────

if DRY:
    print(f'\n{"═" * 72}')
    print('  DRY RUN — no files written')
    print('  Pass --apply to commit changes and create .bak backup')
    print(f'{"═" * 72}\n')
else:
    shutil.copy(TARGET, BACKUP)
    TARGET.write_text(src, encoding='utf-8')
    print(f'\n{"═" * 72}')
    print(f'  DONE')
    print(f'  backup  → {BACKUP}')
    print(f'  patched → {TARGET}')
    print(f'{"═" * 72}\n')
    print('  Next: tsc --noEmit from client root to verify no regressions')
