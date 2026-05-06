#!/usr/bin/env python3
"""
r3v4-cleanup.py  —  R3 v4 Audio Quality Patcher
═════════════════════════════════════════════════
Applies targeted source-level patches to fix all identified distortion
sources in the R3 v4 audio signal chain. Must be run from the project root.

USAGE:
  python3 r3v4-cleanup.py                # apply all patches
  python3 r3v4-cleanup.py --dry-run      # preview changes, no writes
  python3 r3v4-cleanup.py --check        # report idempotency state only
  python3 r3v4-cleanup.py --fix 1,3,5   # apply specific fixes only
  python3 r3v4-cleanup.py --help         # show this message

WHAT IT FIXES (in order):
  Fix 1  VoicePool.trigger()              — instant gain step → 8ms ramp (click on note-on)
  Fix 2  instrument-engine.ts             — masterGain headroom + soft limiter + 8ms ramp
  Fix 3  distortion.ts                   — remove toDestination() double-routing
  Fix 4  instrument-processor.worklet.ts — gentler compression + makeup gain
  Fix 5  instrument-engine.ts            — drum noise amplitude + piano harmonic balance

WHAT IS NOT CHANGED:
  loopEngine master chain  — already has Compressor + Limiter correctly wired
  MixerChannel             — signal path correct, gains sane (0.8 default)
  VoicePool.release()      — setTargetAtTime fade is correct
  audio-clip.ts            — fade in/out logic is correct
  smoothParam              — setTargetAtTime(0.01) is correct and used properly

EXIT CODES:
  0  — all patches applied (or already applied)
  1  — one or more patches failed
  2  — dry-run / check complete (no writes made)
"""

import sys
import shutil
from pathlib import Path
from datetime import datetime

# ── Args ───────────────────────────────────────────────────────────────────────
ARGV    = sys.argv[1:]
DRY_RUN = '--dry-run' in ARGV
CHECK   = '--check'   in ARGV
HELP    = '--help'    in ARGV

_VALID_FIX_NUMS = {1, 2, 3, 4, 5}

_fix_arg: set[int] = set()
_fix_seen = False
for _i, _a in enumerate(ARGV):
    if _a == '--fix':
        _fix_seen = True
        if _i + 1 >= len(ARGV) or ARGV[_i + 1].startswith('--'):
            # Bug fix: --fix with no value must error, not silently run all
            print("  \033[0;31m✗\033[0m --fix requires a value, e.g. --fix 1,3,5")
            sys.exit(1)
        try:
            _fix_arg = {int(x.strip()) for x in ARGV[_i + 1].split(',')}
        except ValueError:
            print("  \033[0;31m✗\033[0m --fix requires comma-separated integers, e.g. --fix 1,3,5")
            sys.exit(1)
        # Bug fix: unknown fix numbers must warn, not silently run nothing
        _unknown = _fix_arg - _VALID_FIX_NUMS
        if _unknown:
            print(f"  \033[0;31m✗\033[0m --fix: unknown fix number(s): {sorted(_unknown)}")
            print(f"       Valid numbers: {sorted(_VALID_FIX_NUMS)}")
            sys.exit(1)
RUN_FIXES: set[int] = _fix_arg   # empty set = run all

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE       = Path(__file__).resolve().parent
BACKUP_DIR = BASE / '.r3-backups' / datetime.now().strftime('%Y%m%d_%H%M%S')

# ── Colours + box-drawing ──────────────────────────────────────────────────────
GRN  = '\033[0;32m'; RED  = '\033[0;31m'; YLW  = '\033[1;33m'
CYN  = '\033[0;36m'; DIM  = '\033[2m';    RST  = '\033[0m'
BOLD = '\033[1m';    WHT  = '\033[1;37m'
HR   = '\u2500'   # single horizontal  (avoids backslash-in-f-string on Py < 3.12)
EQ   = '\u2550'   # double horizontal

# ── Result tracking ────────────────────────────────────────────────────────────
PASS_L: list[str] = []
SKIP_L: list[str] = []
FAIL_L: list[str] = []

def ok(m: str)   -> None: print(f"  {GRN}\u2713{RST} {m}");                     PASS_L.append(m)
def skip(m: str) -> None: print(f"  {DIM}\u00b7 {m} \u2014 already applied{RST}"); SKIP_L.append(m)
def fail(m: str) -> None: print(f"  {RED}\u2717{RST} {m}");                     FAIL_L.append(m)
def info(m: str) -> None: print(f"  {DIM}{m}{RST}")
def dry(m: str)  -> None: print(f"  {CYN}\u21b3 DRY{RST} {m}")

def section(n: int, t: str) -> None:
    label = f"Fix {n}: {t}"
    print(f"\n{BOLD}{WHT}{EQ}{EQ} {label} {HR*max(0, 52-len(label))}{RST}")

def hdr(t: str) -> None:
    bar = EQ * 58
    print(f"\n{BOLD}{WHT}{bar}{RST}")
    print(f"  {BOLD}{WHT}{t}{RST}")
    print(f"{BOLD}{WHT}{bar}{RST}")

# ── File helpers ───────────────────────────────────────────────────────────────
_backed_up: set[Path] = set()

def _backup(p: Path) -> None:
    """Copy p into BACKUP_DIR once per file per run."""
    if p in _backed_up:
        return
    rel  = p.relative_to(BASE)
    dest = BACKUP_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)
    _backed_up.add(p)
    info(f"Backed up: {rel} \u2192 {dest.relative_to(BASE)}")


def read(rel: str) -> str | None:
    p = BASE / rel
    if not p.exists():
        fail(f"File not found: {rel}")
        return None
    try:
        return p.read_text(encoding='utf-8')
    except OSError as e:
        fail(f"Cannot read {rel}: {e}")
        return None


def patch(rel: str, old: str, new: str, desc: str) -> bool:
    """Search-and-replace patch with idempotency, backup, and dry-run support."""
    content = read(rel)
    if content is None:
        return False
    if new in content:
        skip(desc)
        return True
    if old not in content:
        fail(f"{desc}")
        info(f"Anchor not found in {rel}")
        info(f"Expected: {repr(old[:100])}")
        return False
    if DRY_RUN or CHECK:
        dry(desc)
        return True
    _backup(BASE / rel)
    (BASE / rel).write_text(content.replace(old, new, 1), encoding='utf-8')
    ok(desc)
    return True


# ── Pre-flight ─────────────────────────────────────────────────────────────────
REQUIRED_FILES = [
    "client/src/audio/voice-pool.ts",
    "client/src/audio/core/instrument-engine.ts",
    "client/src/audio/effects/distortion.ts",
    "client/src/worklets/instrument-processor.worklet.ts",
]

def preflight() -> bool:
    print(f"\n{BOLD}Pre-flight: checking required files{RST}")
    missing = 0
    for rel in REQUIRED_FILES:
        if (BASE / rel).exists():
            info(f"found   {rel}")
        else:
            # Use direct print — not fail() — so preflight errors don't
            # contaminate FAIL_L, which is reserved for patch() results only.
            print(f"  {RED}\u2717{RST} missing {rel}")
            missing += 1
    if missing:
        print(f"\n  {RED}Pre-flight failed \u2014 {missing} file(s) missing.{RST}")
        print(f"  Run from the project root:  cd ~/Stable/R3\\ v4")
        return False
    info("All required files present.")
    return True


# ── Fix 1: VoicePool ──────────────────────────────────────────────────────────
def fix_voice_pool() -> None:
    section(1, "VoicePool \u2014 instant gain step \u2192 8ms ramp")
    patch(
        "client/src/audio/voice-pool.ts",
        "    gain.gain.setValueAtTime(Math.min(1, Math.max(0, velocity)), this.ctx.currentTime);",
        """    // 8ms attack ramp eliminates click artefact on note-on.
    // An instant step change (setValueAtTime) creates a waveform discontinuity
    // that the ear hears as a click, especially at low frequencies.
    // 8ms is inaudible as an attack but eliminates the discontinuity entirely.
    const clamped = Math.min(1, Math.max(0, velocity));
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(clamped, this.ctx.currentTime + 0.008);""",
        "VoicePool.trigger: 8ms ramp on note-on"
    )


# ── Fix 2: instrument-engine ──────────────────────────────────────────────────
def fix_instrument_engine() -> None:
    section(2, "instrument-engine \u2014 headroom + limiter + 8ms ramp")

    patch(
        "client/src/audio/core/instrument-engine.ts",
        "    this.masterGain.gain.value = 0.95;",
        """    // 0.72 = -2.8 dBFS — headroom for voice summing.
    // With 32 voices at gain=1.0 and masterGain=0.95, any 2+ simultaneous
    // note-ons sum to >0 dBFS and clip. 0.72 gives ~4 voices of headroom
    // before the downstream limiter fires.
    this.masterGain.gain.value = 0.72;""",
        "instrument-engine: masterGain 0.95 \u2192 0.72 (voice summing headroom)"
    )

    patch(
        "client/src/audio/core/instrument-engine.ts",
        "    // ── AudioWorklet — sample-accurate gain + soft-knee compression ──────────\n"
        "    // Inserted between masterGain and destination.\n"
        "    // Registration name 'instrument-processor' is safe — worklets/ directory\n"
        "    // was created by the expert patch and contained no prior registrations.\n"
        "    // Falls back to direct connection if worklet loading fails (test env,\n"
        "    // bundler without worklet support, or HTTP context without HTTPS).\n"
        "    try {",
        """    // ── Soft limiter — catches summing peaks before worklet/destination ────────
    // DynamicsCompressorNode configured as a transparent limiter:
    //   threshold: -3 dBFS  — only fires on actual peaks, not normal material
    //   knee:       0 dB    — hard knee (limiting, not compression)
    //   ratio:      20:1    — effectively a limiter above threshold
    //   attack:     0.003s  — fast enough to catch transients
    //   release:    0.1s    — quick recovery, no pumping on drums
    // Adds ~0.5ms lookahead latency — inaudible in a DAW context.
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value      = 0;
    limiter.ratio.value     = 20;
    limiter.attack.value    = 0.003;
    limiter.release.value   = 0.1;
    this.masterGain.connect(limiter);

    // ── AudioWorklet — sample-accurate gain + soft-knee compression ──────────
    // Inserted between limiter and destination.
    // Registration name 'instrument-processor' is safe — worklets/ directory
    // was created by the expert patch and contained no prior registrations.
    // Falls back to direct connection if worklet loading fails (test env,
    // bundler without worklet support, or HTTP context without HTTPS).
    try {""",
        "instrument-engine: add DynamicsCompressor soft limiter after masterGain"
    )

    patch(
        "client/src/audio/core/instrument-engine.ts",
        "      this.procNode = new AudioWorkletNode(this.ctx, 'instrument-processor');\n"
        "      this.masterGain.connect(this.procNode);\n"
        "      this.procNode.connect(this.ctx.destination);\n"
        "    } catch {\n"
        "      // Worklet unavailable — bypass with direct connection (no quality loss\n"
        "      // to samples; only the worklet-side compression is skipped)\n"
        "      this.masterGain.connect(this.ctx.destination);\n"
        "    }",
        "      this.procNode = new AudioWorkletNode(this.ctx, 'instrument-processor');\n"
        "      limiter.connect(this.procNode);\n"
        "      this.procNode.connect(this.ctx.destination);\n"
        "    } catch {\n"
        "      // Worklet unavailable — bypass limiter with direct connection (no quality\n"
        "      // loss to samples; only the worklet-side compression is skipped)\n"
        "      limiter.connect(this.ctx.destination);\n"
        "    }",
        "instrument-engine: wire limiter \u2192 worklet/destination"
    )

    patch(
        "client/src/audio/core/instrument-engine.ts",
        "        voice.gain.gain.linearRampToValueAtTime(vol, now + 0.001);",
        "        voice.gain.gain.linearRampToValueAtTime(vol, now + 0.008);  // 8ms \u2014 click-free",
        "instrument-engine: 1ms attack ramp \u2192 8ms"
    )


# ── Fix 3: DistortionEffect ───────────────────────────────────────────────────
def fix_distortion() -> None:
    section(3, "DistortionEffect \u2014 remove toDestination() double-routing")
    patch(
        "client/src/audio/effects/distortion.ts",
        "    this.output.toDestination();",
        """    // DO NOT call toDestination() here.
    // DistortionEffect is an insert effect — callers connect it into their
    // signal chain via connect(). Calling toDestination() caused the distorted
    // signal to route DIRECTLY to speakers at full gain, bypassing the master
    // bus, MixerChannel volume, and any downstream limiting.
    // This was the primary source of uncontrolled loud distortion in the app.
    // Callers must explicitly route: source → dist → channel input / FX chain.""",
        "DistortionEffect: remove toDestination() double routing"
    )


# ── Fix 4: M/S Worklet ────────────────────────────────────────────────────────
def fix_worklet() -> None:
    section(4, "M/S Worklet \u2014 gentler compression + makeup gain")

    patch(
        "client/src/worklets/instrument-processor.worklet.ts",
        '      { name: "compThreshold", defaultValue: -24, minValue: -60, maxValue: 0   },',
        '      { name: "compThreshold", defaultValue: -18, minValue: -60, maxValue: 0   }, // was -24: too aggressive',
        "worklet: compThreshold -24 \u2192 -18 dBFS (less gain reduction on normal material)"
    )
    patch(
        "client/src/worklets/instrument-processor.worklet.ts",
        '      { name: "compRatio",     defaultValue: 4,   minValue: 1,   maxValue: 20  },',
        '      { name: "compRatio",     defaultValue: 2.5, minValue: 1,   maxValue: 20  }, // was 4: too much squash',
        "worklet: compRatio 4:1 \u2192 2.5:1 (preserve dynamics)"
    )
    patch(
        "client/src/worklets/instrument-processor.worklet.ts",
        '      { name: "masterGain",    defaultValue: 1.0, minValue: 0,   maxValue: 2.0 },',
        '      { name: "masterGain",    defaultValue: 1.15, minValue: 0,  maxValue: 2.0 }, // makeup gain for compression',
        "worklet: masterGain 1.0 \u2192 1.15 (makeup gain for compression loss)"
    )
    patch(
        "client/src/worklets/instrument-processor.worklet.ts",
        '      { name: "sideThreshold", defaultValue: -30, minValue: -60, maxValue: 0   },',
        '      { name: "sideThreshold", defaultValue: -24, minValue: -60, maxValue: 0   }, // was -30: over-compressed stereo',
        "worklet: sideThreshold -30 \u2192 -24 (less stereo field compression)"
    )


# ── Fix 5: Generated samples ──────────────────────────────────────────────────
def fix_generated_samples() -> None:
    section(5, "Generated samples \u2014 noise amplitude + piano harmonic balance")

    patch(
        "client/src/audio/core/instrument-engine.ts",
        "      const noise = (Math.random() * 2 - 1) * 0.3;",
        "      const noise = (Math.random() * 2 - 1) * 0.12;  // was 0.3: broadband noise was too loud",
        "instrument-engine: drum noise amplitude 0.3 \u2192 0.12"
    )
    patch(
        "client/src/audio/core/instrument-engine.ts",
        "      const fundamental = Math.sin(2 * Math.PI * freq * t) * 0.5;\n"
        "      const harmonic2 = Math.sin(4 * Math.PI * freq * t) * 0.25;\n"
        "      const harmonic3 = Math.sin(6 * Math.PI * freq * t) * 0.125;\n"
        "      const harmonic4 = Math.sin(8 * Math.PI * freq * t) * 0.0625;\n"
        "\n"
        "      data[i] = (fundamental + harmonic2 + harmonic3 + harmonic4) * envelope;",
        """      // Rebalanced harmonic series — total peak < 0.75 (was up to 0.9375).
      // Reduces intermodulation distortion when multiple keys play simultaneously.
      // Ratios follow a natural harmonic decay (0.45, 0.18, 0.08, 0.04).
      const fundamental = Math.sin(2 * Math.PI * freq * t) * 0.45;
      const harmonic2   = Math.sin(4 * Math.PI * freq * t) * 0.18;
      const harmonic3   = Math.sin(6 * Math.PI * freq * t) * 0.08;
      const harmonic4   = Math.sin(8 * Math.PI * freq * t) * 0.04;

      data[i] = (fundamental + harmonic2 + harmonic3 + harmonic4) * envelope;""",
        "instrument-engine: piano harmonics rebalanced (peak 0.9375 \u2192 0.75)"
    )


# ── Fix registry ───────────────────────────────────────────────────────────────
FIXES = [
    (1, "VoicePool \u2014 8ms ramp",                    fix_voice_pool),
    (2, "instrument-engine \u2014 headroom + limiter",  fix_instrument_engine),
    (3, "DistortionEffect \u2014 remove toDestination", fix_distortion),
    (4, "M/S Worklet \u2014 gentler compression",       fix_worklet),
    (5, "Generated samples \u2014 noise + harmonics",   fix_generated_samples),
]


# ── Main ───────────────────────────────────────────────────────────────────────
def main() -> None:
    if HELP:
        print(__doc__)
        sys.exit(0)

    mode_label = (
        f"{YLW}CHECK (no writes){RST}"    if CHECK   else
        f"{YLW}DRY-RUN (no writes){RST}"  if DRY_RUN else
        f"{GRN}APPLY{RST}"
    )

    hdr("R3 v4  \u2014  Audio Quality Patcher")
    print(f"  Root:  {BASE}")
    print(f"  Mode:  {mode_label}")
    if RUN_FIXES:
        print(f"  Fixes: {', '.join(str(n) for n in sorted(RUN_FIXES))}")

    if not preflight():
        sys.exit(1)

    for num, _label, fn in FIXES:
        if RUN_FIXES and num not in RUN_FIXES:
            continue
        fn()

    # ── Summary ────────────────────────────────────────────────────────────────
    bar = EQ * 58
    print(f"\n{BOLD}{WHT}{bar}{RST}")
    print(f"  {BOLD}Result{RST}")
    print(f"{BOLD}{WHT}{bar}{RST}")

    parts = []
    if PASS_L: parts.append(f"{GRN}{len(PASS_L)} applied{RST}")
    if SKIP_L: parts.append(f"{DIM}{len(SKIP_L)} already done{RST}")
    if FAIL_L: parts.append(f"{RED}{len(FAIL_L)} failed{RST}")
    # Bug fix: if nothing ran (e.g. --fix with all valid but no-op set), say so
    print(f"  {('  \u00b7  ').join(parts) if parts else f'{YLW}no fixes ran{RST}'}")

    if FAIL_L:
        print()
        for f in FAIL_L:
            print(f"  {RED}\u2717{RST} {f}")

    if DRY_RUN or CHECK:
        verb = "check" if CHECK else "dry-run"
        print(f"\n  {YLW}No files were changed ({verb} mode).{RST}")
        if FAIL_L:
            # Bug fix: failures during dry-run (missing anchors/files) must
            # exit 1, not 2 — so CI knows the real run would also fail.
            print(f"  {RED}Failures detected — the run would NOT succeed.{RST}")
            sys.exit(1)
        print(f"  Re-run without --{verb} to apply.")
        sys.exit(2)

    if FAIL_L:
        sys.exit(1)

    if _backed_up:
        print(f"\n  {DIM}Originals backed up to: {BACKUP_DIR.relative_to(BASE)}{RST}")

    print(f"""
  {BOLD}Next steps:{RST}
    pnpm build                    # confirm tsc clean

  {BOLD}Manual test checklist:{RST}
    \u2022 Single pad hit              \u2192 clean, no click
    \u2022 4+ pads simultaneously      \u2192 no clipping
    \u2022 Distortion effect enabled   \u2192 routes through master bus (not direct to speakers)
    \u2022 loopEngine tracks           \u2192 unchanged (already had limiter)

  {BOLD}Worklet tuning (after listening test):{RST}
    instrumentEngine.setMSWidth(1.0)   // default stereo
    instrumentEngine.setMidGain(1.0)   // no mid boost
    // compThreshold/ratio now softer \u2014 tighten via AudioWorkletNode.parameters
    // if material still feels too dynamic (see instrument-engine.ts setMSParams)
""")
    sys.exit(0)


if __name__ == "__main__":
    main()
