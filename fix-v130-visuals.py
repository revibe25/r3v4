#!/usr/bin/env python3
"""
R3 v4 Multitrack v1.3.0 — Visual Fix Script
Fixes 6 visual issues identified by reference comparison:

1. Track canvas not full width (CSS: #tl canvas missing width/height 100%)
2. Mixer simplified (ensureMixer: wrong classes, missing pan knob SVG, fader zone)
3. DSP editor text overlap (ensureDspEditor: 2 children in 3-col grid)
4. Analyzer canvas empty (CSS: #cvA missing dimensions)
5. Arrange markers not visible (fixed by #1 — drawTimeline already draws them)
6. Automation curve not visible (fixed by #1 — drawTimeline already draws it)

Usage: python3 fix-v130-visuals.py
"""

import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path.home() / "Projects" / "r3v4"
CLIENT = ROOT / "client"
FEATURE = CLIENT / "src" / "features" / "multitrack-v130"

CSS_PATH = FEATURE / "styles" / "reference.css"
RUNTIME_PATH = FEATURE / "renderers" / "useV130PresentationRuntime.ts"

# ── Verify files exist ──────────────────────────────────────────────────────

for label, path in [("reference.css", CSS_PATH), ("runtime", RUNTIME_PATH)]:
    if not path.exists():
        print(f"FATAL: {label} not found at {path}")
        sys.exit(1)

# ── Backup ───────────────────────────────────────────────────────────────────

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = Path.home() / f".r3v4-backups/visual-fix-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(CSS_PATH, backup_dir / "reference.css")
shutil.copy2(RUNTIME_PATH, backup_dir / "useV130PresentationRuntime.ts")
print(f"Backups saved to {backup_dir}")

fixes_applied = 0

# ════════════════════════════════════════════════════════════════════════════
# FIX 1 + 4: CSS canvas sizing
# ════════════════════════════════════════════════════════════════════════════

css = CSS_PATH.read_text()

# Fix 1: Timeline canvases need to fill #tl container
old_tl = """.r3-multitrack-v130 #tl canvas {
  position: absolute;
  left: 0;
  top: 0;
}"""

new_tl = """.r3-multitrack-v130 #tl canvas {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}"""

if old_tl in css:
    css = css.replace(old_tl, new_tl)
    print("  ✓ FIX 1: #tl canvas → width/height 100% (track area full width)")
    fixes_applied += 1
else:
    print("  ⚠ FIX 1: Could not find #tl canvas rule")

# Fix 4: Analyzer canvas needs dimensions
old_cvA = """.r3-multitrack-v130 #cvA {
  display: block;
}"""

new_cvA = """.r3-multitrack-v130 #cvA {
  display: block;
  width: 100%;
  height: 100%;
}"""

if old_cvA in css:
    css = css.replace(old_cvA, new_cvA)
    print("  ✓ FIX 4: #cvA canvas → width/height 100% (analyzer visible)")
    fixes_applied += 1
else:
    print("  ⚠ FIX 4: Could not find #cvA rule")

CSS_PATH.write_text(css)

# ════════════════════════════════════════════════════════════════════════════
# FIX 2: Mixer strips — proper pan knob SVG, fader zone, bus label
# FIX 3: DSP editor — fix 3-column grid layout
# ════════════════════════════════════════════════════════════════════════════

runtime = RUNTIME_PATH.read_text()

# ── FIX 2: Replace mixer strip innerHTML ─────────────────────────────────

old_strip_html = (
    """      strip.innerHTML =\n"""
    """        `<div class="nm">${track.label}</div>` +\n"""
    """        `<div class="ms">` +\n"""
    """        `<button class="msr m">M</button>` +\n"""
    """        `<button class="msr s">S</button>` +\n"""
    """        `</div>` +\n"""
    """        `<div class="vmet"><i></i></div>` +\n"""
    """        `<div class="kn">${Math.round(track.gain * 100)}</div>` +\n"""
    """        `<div class="fader"><i></i></div>` +\n"""
    """        `<div class="db">${(20 * Math.log10(Math.max(track.gain, 0.001))).toFixed(1)} dB</div>`;"""
)

new_strip_html = (
    """      const panAngle = 0; // center\n"""
    """      const arcTotal = 87.96; // 2πr for r=14, 270° arc\n"""
    """      const panOffset = arcTotal / 2; // center position\n"""
    """      const dbValue = (20 * Math.log10(Math.max(track.gain, 0.001))).toFixed(1);\n"""
    """      const faderPercent = Math.max(3, Math.min(100, track.gain * 100));\n"""
    """      strip.innerHTML =\n"""
    """        `<div class="nm">${track.label}</div>` +\n"""
    """        `<div class="ms">` +\n"""
    """        `<button class="msr m">M</button>` +\n"""
    """        `<button class="msr s">S</button>` +\n"""
    """        `</div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5">` +\n"""
    """        `<svg width="36" height="36" viewBox="0 0 36 36">` +\n"""
    """        `<circle class="kt" cx="18" cy="18" r="14"/>` +\n"""
    """        `<circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="${arcTotal}" stroke-dashoffset="${panOffset}" transform="rotate(135 18 18)"/>` +\n"""
    """        `<circle class="kb" cx="18" cy="18" r="9"/>` +\n"""
    """        `<line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(${panAngle} 18 18)"/>` +\n"""
    """        `</svg>` +\n"""
    """        `<b>C</b>` +\n"""
    """        `<i>Pan</i>` +\n"""
    """        `</div>` +\n"""
    """        `<div class="fz">` +\n"""
    """        `<div class="vm"><i style="transform: scaleY(${faderPercent / 100})"></i></div>` +\n"""
    """        `<div class="fader"><i style="top: ${100 - faderPercent}%"></i></div>` +\n"""
    """        `</div>` +\n"""
    """        `<output>${dbValue} dB</output>` +\n"""
    """        `<div class="bus">${track.type === 'audio' ? 'Main' : 'Music Bus'}</div>`;"""
)

if old_strip_html in runtime:
    runtime = runtime.replace(old_strip_html, new_strip_html)
    print("  ✓ FIX 2a: Mixer strip → pan knob SVG + fader zone + bus label")
    fixes_applied += 1
else:
    print("  ⚠ FIX 2a: Could not match mixer strip innerHTML")

# ── FIX 2b: Replace master strip innerHTML ───────────────────────────────

old_master_html = (
    """  master.innerHTML =\n"""
    """    `<div class="nm">MASTER</div>` +\n"""
    """    `<div class="vmet"><i></i></div>` +\n"""
    """    `<div class="fader"><i></i></div>` +\n"""
    """    `<div class="db">${useDAWStore.getState().masterGain.toFixed(2)}</div>`;"""
)

new_master_html = (
    """  const masterGain = useDAWStore.getState().masterGain;\n"""
    """  const masterDb = (20 * Math.log10(Math.max(masterGain, 0.001))).toFixed(1);\n"""
    """  const masterFader = Math.max(3, Math.min(100, masterGain * 100));\n"""
    """  master.innerHTML =\n"""
    """    `<div class="nm">MASTER</div>` +\n"""
    """    `<div class="ms">` +\n"""
    """    `<button class="msr m">M</button>` +\n"""
    """    `<button class="msr s">S</button>` +\n"""
    """    `</div>` +\n"""
    """    `<div class="fz">` +\n"""
    """    `<div class="vm"><i style="transform: scaleY(${masterFader / 100})"></i></div>` +\n"""
    """    `<div class="fader"><i style="top: ${100 - masterFader}%"></i></div>` +\n"""
    """    `</div>` +\n"""
    """    `<output>${masterDb} dB</output>`;"""
)

if old_master_html in runtime:
    runtime = runtime.replace(old_master_html, new_master_html)
    print("  ✓ FIX 2b: Master strip → fader zone + proper dB readout")
    fixes_applied += 1
else:
    print("  ⚠ FIX 2b: Could not match master strip innerHTML")

# ── FIX 2c: Update syncDom to use correct class selectors ───────────────

# The CSS uses .vm for vertical meters, but code references .vmet
old_vmet_strip = """strip.querySelector<HTMLElement>('.vmet i')"""
new_vmet_strip = """strip.querySelector<HTMLElement>('.vm i')"""

count_vmet = runtime.count(old_vmet_strip)
if count_vmet > 0:
    runtime = runtime.replace(old_vmet_strip, new_vmet_strip)
    print(f"  ✓ FIX 2c: .vmet → .vm in syncDom ({count_vmet} occurrences)")
    fixes_applied += 1
else:
    print("  ⚠ FIX 2c: No .vmet references found in syncDom")

# ── FIX 3: DSP editor — fix HTML template for 3-column grid ─────────────

old_dsp_master = (
    """      editor.innerHTML =\n"""
    """        `<div class="dev"><b>MASTER</b><span>Professional bus processing</span></div>` +\n"""
    """        `<div class="dev"><span>R3 Compressor</span><span>0.0 dB GR</span></div>` +\n"""
    """        `<div class="dev"><span>R3 Limiter</span><span>-1.0 dB ceiling</span></div>`;"""
)

new_dsp_master = (
    """      editor.innerHTML =\n"""
    """        `<div class="list">` +\n"""
    """        `<div class="dev" aria-selected="true"><span class="no" aria-pressed="true">1</span><span>R3 Compressor</span><span>›</span></div>` +\n"""
    """        `<div class="dev"><span class="no">2</span><span>R3 Parametric EQ</span><span>›</span></div>` +\n"""
    """        `<div class="dev"><span class="no">3</span><span>R3 De-Esser</span><span>›</span></div>` +\n"""
    """        `<div class="dev"><span class="no">4</span><span>R3 Reverb</span><span>›</span></div>` +\n"""
    """        `<div class="dev"><span class="no">5</span><span>R3 Saturation</span><span>›</span></div>` +\n"""
    """        `<div class="dev"><span class="no">6</span><span>R3 Limiter</span><span>›</span></div>` +\n"""
    """        `</div>` +\n"""
    """        `<div class="ed">` +\n"""
    """        `<h3>R3 Compressor <small>active on master bus</small>` +\n"""
    """        `<span class="grm"><span>GR</span><div><i></i></div><output id="dspGr">0.0 dB</output></span></h3>` +\n"""
    """        `<div class="kg">` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="30" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(-60 18 18)"/></svg><b>-18.0</b><i>Threshold</i></div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="55" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(-20 18 18)"/></svg><b>4.0:1</b><i>Ratio</i></div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="70" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(20 18 18)"/></svg><b>10.0</b><i>Attack</i></div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="25" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(80 18 18)"/></svg><b>120</b><i>Release</i></div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="60" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(-10 18 18)"/></svg><b>+6.0</b><i>Makeup</i></div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="55" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(-15 18 18)"/></svg><b>+2.0</b><i>Knee</i></div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="0" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(135 18 18)"/></svg><b>100%</b><i>Mix</i></div>` +\n"""
    """        `</div>` +\n"""
    """        `</div>`;"""
)

if old_dsp_master in runtime:
    runtime = runtime.replace(old_dsp_master, new_dsp_master)
    print("  ✓ FIX 3a: DSP master → proper 3-col grid + parameter knobs")
    fixes_applied += 1
else:
    print("  ⚠ FIX 3a: Could not match DSP master template")

# ── FIX 3b: DSP vox template ────────────────────────────────────────────

old_dsp_vox = (
    """      editor.innerHTML =\n"""
    """        `<div class="dev"><b>VOX</b><span>Track DSP target</span></div>` +\n"""
    """        `<div class="dev"><span>R3 Compressor</span><span>Track insert</span></div>` +\n"""
    """        `<div class="dev"><span>R3 De-Esser</span><span>Vocal control</span></div>`;"""
)

new_dsp_vox = (
    """      editor.innerHTML =\n"""
    """        `<div class="list">` +\n"""
    """        `<div class="dev" aria-selected="true"><span class="no" aria-pressed="true">1</span><span>R3 Compressor</span><span>›</span></div>` +\n"""
    """        `<div class="dev"><span class="no">2</span><span>R3 De-Esser</span><span>›</span></div>` +\n"""
    """        `</div>` +\n"""
    """        `<div class="ed">` +\n"""
    """        `<h3>R3 Compressor <small>track insert</small>` +\n"""
    """        `<span class="grm"><span>GR</span><div><i></i></div><output>0.0 dB</output></span></h3>` +\n"""
    """        `<div class="kg">` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="30" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(-60 18 18)"/></svg><b>-18.0</b><i>Threshold</i></div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="55" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(-20 18 18)"/></svg><b>4.0:1</b><i>Ratio</i></div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="70" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(20 18 18)"/></svg><b>10.0</b><i>Attack</i></div>` +\n"""
    """        `<div class="kn" style="--kc: #35d6f5"><svg width="36" height="36" viewBox="0 0 36 36"><circle class="kt" cx="18" cy="18" r="14"/><circle class="ka" cx="18" cy="18" r="14" stroke-dasharray="87.96" stroke-dashoffset="25" transform="rotate(135 18 18)"/><circle class="kb" cx="18" cy="18" r="9"/><line class="ki" x1="18" y1="18" x2="18" y2="8" transform="rotate(80 18 18)"/></svg><b>120</b><i>Release</i></div>` +\n"""
    """        `</div>` +\n"""
    """        `</div>`;"""
)

if old_dsp_vox in runtime:
    runtime = runtime.replace(old_dsp_vox, new_dsp_vox)
    print("  ✓ FIX 3b: DSP vox → proper 3-col grid + parameter knobs")
    fixes_applied += 1
else:
    print("  ⚠ FIX 3b: Could not match DSP vox template")

# ── Write runtime ────────────────────────────────────────────────────────

RUNTIME_PATH.write_text(runtime)

# ═══════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════

print(f"\n{'═' * 60}")
print(f"  {fixes_applied} fixes applied")
print(f"  Backups: {backup_dir}")
print(f"{'═' * 60}")

if fixes_applied >= 4:
    print("\n  Next steps:")
    print("  1. Check the browser (Vite should hot-reload)")
    print("  2. Verify: track area fills width, analyzer draws, mixer has knobs")
    print("  3. Run: cd ~/Projects/r3v4/client && pnpm exec tsc --noEmit")
    print("  4. Commit when satisfied")
else:
    print("\n  ⚠ Some fixes did not match. Check the source files manually.")
    print(f"  Rollback: cp {backup_dir}/* back to source locations")
