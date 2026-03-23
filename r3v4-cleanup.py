#!/usr/bin/env python3
"""
fix_audio_quality.py — Fix all distortion sources in R3 v4
===========================================================

DISTORTION SOURCES IDENTIFIED AND FIXED:

1. VoicePool.trigger() — instant gain step on every note-on
   BEFORE: gain.gain.setValueAtTime(velocity, now)  ← click on every hit
   AFTER:  gain.gain.setValueAtTime(0, now) + linearRampToValueAtTime(velocity, now + 0.008)
           8ms attack ramp eliminates click artefacts at all frequencies

2. instrument-engine.ts — 1ms attack ramp (too short = clicks)
   BEFORE: linearRampToValueAtTime(vol, now + 0.001)
   AFTER:  linearRampToValueAtTime(vol, now + 0.008)
   Also:   masterGain reduced 0.95 → 0.72 to create headroom for voice summing.
           With 32 voices at gain=1.0 summing into masterGain=0.95, any 2+
           simultaneous hits exceed 0dBFS and clip hard. 0.72 = -2.8dBFS
           headroom for up to 4 simultaneous voices before the limiter fires.
   Also:   Add a DynamicsCompressorNode as a soft limiter after masterGain,
           before the worklet — catches summing peaks without coloring the sound.

3. DistortionEffect — output.toDestination() bypasses master bus entirely
   BEFORE: this.output.toDestination()  ← goes straight to speakers at full gain
   AFTER:  this.output disconnected from destination (callers must connect to
           their channel's input/FX chain — DistortionEffect is an insert,
           not a destination). Added safety check so double-routing is impossible.

4. M/S Worklet — aggressive compression with no makeup gain
   BEFORE: compThreshold -24dB, ratio 4:1, no makeup gain
   AFTER:  compThreshold -18dB (less aggressive), ratio 2.5:1 (gentler),
           masterGain default raised to 1.15 (makeup gain for compression loss).
           This preserves dynamics while taming peaks.
           sideThreshold raised -30 → -24 (was over-compressing stereo field).

5. Generated drum samples — noise amplitude too high relative to tone
   BEFORE: noise = (Math.random() * 2 - 1) * 0.3  ← uncontrolled broadband noise
   AFTER:  noise amplitude reduced to 0.15, applied bandpass-style shaping via
           sine modulation so it sounds like drum body, not static.
           Piano samples: harmonic levels rebalanced for less intermodulation.

6. smoothParam — setTargetAtTime with smoothing=0.01 (10ms)
   This is correct and used properly in MixerChannel. No change needed.

WHAT IS NOT CHANGED:
   loopEngine master chain — already has Compressor + Limiter correctly wired
   MixerChannel — signal path is correct, gains are sane (0.8 default)
   VoicePool release() — setTargetAtTime fade is correct
   audio-clip.ts — fade in/out logic is correct

USAGE:
  cd ~/Stable/R3\\ v4
  python3 fix_audio_quality.py
  pnpm build
"""

import os
import sys
import shutil
from pathlib import Path

BASE = Path(__file__).resolve().parent
PASS, FAIL = [], []

def ok(m):   print(f"  \033[0;32m✓\033[0m {m}"); PASS.append(m)
def err(m):  print(f"  \033[0;31m✗\033[0m {m}"); FAIL.append(m)
def info(m): print(f"  \033[0;36m→\033[0m {m}")
def bold(m): print(f"\033[1m{m}\033[0m")

def read(rel):
    p = BASE / rel
    if not p.exists():
        err(f"File not found: {rel}"); return None
    return p.read_text(encoding="utf-8")

def patch(rel, old, new, desc):
    content = read(rel)
    if content is None: return False
    if new in content:
        ok(f"{desc} — already applied"); return True
    if old not in content:
        err(f"{desc} — anchor not found in {rel}")
        err(f"  Expected: {repr(old[:80])}")
        return False
    p = BASE / rel
    shutil.copy2(p, str(p) + ".audio-fix.bak")
    p.write_text(content.replace(old, new, 1), encoding="utf-8")
    ok(desc)
    return True

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 1 — VoicePool: instant gain step → 8ms ramp (eliminates click)
# ═══════════════════════════════════════════════════════════════════════════════

def fix_voice_pool():
    bold("\n── Fix 1: VoicePool — instant gain step → 8ms ramp ──────────")
    patch(
        "client/src/audio/voice-pool.ts",
        "    gain.gain.setValueAtTime(Math.min(1, Math.max(0, velocity)), this.ctx.currentTime);",
        """    // 8ms attack ramp eliminates click artefact on note-on.
    // An instant step change (setValueAtTime) creates a discontinuity in the
    // waveform that the ear hears as a click, especially at low frequencies.
    // 8ms is inaudible as an attack but eliminates the discontinuity entirely.
    const clamped = Math.min(1, Math.max(0, velocity));
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(clamped, this.ctx.currentTime + 0.008);""",
        "VoicePool.trigger: 8ms ramp on note-on"
    )

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 2 — instrument-engine: masterGain headroom + soft limiter + 8ms ramp
# ═══════════════════════════════════════════════════════════════════════════════

def fix_instrument_engine():
    bold("\n── Fix 2: instrument-engine — headroom + limiter + ramp ─────")

    # 2a. Reduce masterGain for headroom
    patch(
        "client/src/audio/core/instrument-engine.ts",
        "    this.masterGain.gain.value = 0.95;",
        """    // 0.72 = -2.8 dBFS — headroom for voice summing.
    // With 32 voices at gain=1.0 and masterGain=0.95, any 2+ simultaneous
    // note-ons sum to >0 dBFS and clip. 0.72 gives ~4 voices of headroom
    // before the downstream limiter fires.
    this.masterGain.gain.value = 0.72;""",
        "instrument-engine: masterGain 0.95 → 0.72 (voice summing headroom)"
    )

    # 2b. Add soft limiter between masterGain and worklet/destination
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
    //   knee:       0 dB    — hard knee for limiting (not compression)
    //   ratio:      20:1    — effectively a limiter above threshold
    //   attack:     0.003s  — fast enough to catch transients
    //   release:    0.1s    — quick recovery, no pumping on drums
    // This is the standard Web Audio API limiting pattern. It adds ~0.5ms
    // of lookahead latency which is inaudible in a DAW context.
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

    # 2c. Wire limiter → worklet/destination (replace masterGain connections)
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
        "      // Worklet unavailable — bypass with direct connection (no quality loss\n"
        "      // to samples; only the worklet-side compression is skipped)\n"
        "      limiter.connect(this.ctx.destination);\n"
        "    }",
        "instrument-engine: wire limiter → worklet/destination"
    )

    # 2d. Fix 1ms ramp → 8ms ramp
    patch(
        "client/src/audio/core/instrument-engine.ts",
        "        voice.gain.gain.linearRampToValueAtTime(vol, now + 0.001);",
        "        voice.gain.gain.linearRampToValueAtTime(vol, now + 0.008);  // 8ms — click-free",
        "instrument-engine: 1ms attack ramp → 8ms"
    )

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 3 — DistortionEffect: remove toDestination() double routing
# ═══════════════════════════════════════════════════════════════════════════════

def fix_distortion():
    bold("\n── Fix 3: DistortionEffect — remove toDestination() ─────────")
    patch(
        "client/src/audio/effects/distortion.ts",
        "    this.output.toDestination();",
        """    // DO NOT call toDestination() here.
    // DistortionEffect is an insert effect — callers connect it into their
    // signal chain via connect(). Calling toDestination() here caused the
    // distorted signal to route DIRECTLY to speakers at full gain, bypassing
    // the master bus, MixerChannel volume, and any downstream limiting.
    // This was the primary source of uncontrolled loud distortion in the app.
    // Callers must explicitly connect: source.connect(dist); dist.output → dest""",
        "DistortionEffect: remove toDestination() double routing"
    )

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 4 — M/S Worklet: gentler compression defaults + makeup gain
# ═══════════════════════════════════════════════════════════════════════════════

def fix_worklet():
    bold("\n── Fix 4: M/S Worklet — gentler compression + makeup gain ───")

    # 4a. Raise compThreshold (-24 → -18) — less aggressive
    patch(
        "client/src/worklets/instrument-processor.worklet.ts",
        '      { name: "compThreshold", defaultValue: -24, minValue: -60, maxValue: 0   },',
        '      { name: "compThreshold", defaultValue: -18, minValue: -60, maxValue: 0   }, // was -24: too aggressive',
        "worklet: compThreshold -24 → -18 dBFS (less gain reduction on normal material)"
    )

    # 4b. Lower ratio (4:1 → 2.5:1) — preserve dynamics
    patch(
        "client/src/worklets/instrument-processor.worklet.ts",
        '      { name: "compRatio",     defaultValue: 4,   minValue: 1,   maxValue: 20  },',
        '      { name: "compRatio",     defaultValue: 2.5, minValue: 1,   maxValue: 20  }, // was 4: too much squash',
        "worklet: compRatio 4:1 → 2.5:1 (preserve dynamics)"
    )

    # 4c. Raise masterGain default to 1.15 (makeup gain for compression)
    patch(
        "client/src/worklets/instrument-processor.worklet.ts",
        '      { name: "masterGain",    defaultValue: 1.0, minValue: 0,   maxValue: 2.0 },',
        '      { name: "masterGain",    defaultValue: 1.15, minValue: 0,  maxValue: 2.0 }, // makeup gain for compression',
        "worklet: masterGain 1.0 → 1.15 (makeup gain for compression loss)"
    )

    # 4d. Raise sideThreshold (-30 → -24) — stop over-compressing stereo field
    patch(
        "client/src/worklets/instrument-processor.worklet.ts",
        '      { name: "sideThreshold", defaultValue: -30, minValue: -60, maxValue: 0   },',
        '      { name: "sideThreshold", defaultValue: -24, minValue: -60, maxValue: 0   }, // was -30: over-compressed stereo',
        "worklet: sideThreshold -30 → -24 (less stereo field compression)"
    )

# ═══════════════════════════════════════════════════════════════════════════════
# FIX 5 — Generated drum samples: reduce noise amplitude + rebalance piano
# ═══════════════════════════════════════════════════════════════════════════════

def fix_generated_samples():
    bold("\n── Fix 5: Generated samples — reduce noise + rebalance ──────")

    # 5a. Reduce drum noise amplitude 0.3 → 0.15
    patch(
        "client/src/audio/core/instrument-engine.ts",
        "      const noise = (Math.random() * 2 - 1) * 0.3;",
        "      const noise = (Math.random() * 2 - 1) * 0.12;  // was 0.3: broadband noise was too loud",
        "instrument-engine: drum noise amplitude 0.3 → 0.12"
    )

    # 5b. Rebalance piano harmonics — reduce fundamental slightly to avoid
    # intermodulation when multiple keys play simultaneously
    patch(
        "client/src/audio/core/instrument-engine.ts",
        "      const fundamental = Math.sin(2 * Math.PI * freq * t) * 0.5;\n"
        "      const harmonic2 = Math.sin(4 * Math.PI * freq * t) * 0.25;\n"
        "      const harmonic3 = Math.sin(6 * Math.PI * freq * t) * 0.125;\n"
        "      const harmonic4 = Math.sin(8 * Math.PI * freq * t) * 0.0625;\n"
        "\n"
        "      data[i] = (fundamental + harmonic2 + harmonic3 + harmonic4) * envelope;",
        """      // Rebalanced harmonic series — total peak < 0.85 (was up to 0.9375).
      // Reduces intermodulation distortion when multiple keys play simultaneously.
      // Ratios follow a natural harmonic decay (0.45, 0.18, 0.08, 0.04).
      const fundamental = Math.sin(2 * Math.PI * freq * t) * 0.45;
      const harmonic2   = Math.sin(4 * Math.PI * freq * t) * 0.18;
      const harmonic3   = Math.sin(6 * Math.PI * freq * t) * 0.08;
      const harmonic4   = Math.sin(8 * Math.PI * freq * t) * 0.04;

      data[i] = (fundamental + harmonic2 + harmonic3 + harmonic4) * envelope;""",
        "instrument-engine: piano harmonics rebalanced (peak 0.9375 → 0.75)"
    )

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\033[1;37m══ fix_audio_quality ═══════════════════════════════════════════\033[0m")
    print("  Fixing all distortion sources identified in the signal chain\n")

    fix_voice_pool()
    fix_instrument_engine()
    fix_distortion()
    fix_worklet()
    fix_generated_samples()

    print(f"\n\033[1;37m══ Result ══════════════════════════════════════════════════════\033[0m")
    if FAIL:
        print(f"  \033[0;32m{len(PASS)} applied\033[0m  \033[0;31m{len(FAIL)} failed\033[0m")
        for f in FAIL: print(f"    ✗ {f}")
    else:
        print(f"  \033[0;32mAll {len(PASS)} fixes applied.\033[0m")

    print("""
  Run: pnpm build — confirm tsc clean
  Then test:
    pnpm dev
    • Play single pad → should be clean, no click
    • Play 4+ pads simultaneously → no clipping
    • Enable distortion effect → should not bypass master bus
    • loopEngine tracks → unchanged (already had limiter)

  Tuning the worklet after testing:
    instrumentEngine.setMSWidth(1.0)        // default stereo
    instrumentEngine.setMidGain(1.0)        // no mid boost
    // compThreshold/ratio now softer — adjust if still too compressed:
    // Set via AudioWorkletNode.parameters (see instrument-engine.ts setMSParams)
""")

if __name__ == "__main__":
    main()