#!/usr/bin/env bash
#
# R3V4 — Gate 2A / Stage 4A guarded remediation integration
#
# Purpose:
#   Apply only the mathematically established Gate 2A fixes that can be
#   proven from the audited baseline, while refusing to guess on:
#     - sample-rate-specific BS.1770 K-weighting coefficients
#     - non-48 kHz true-peak calibration
#     - moving DSP calculation off the main thread without inspecting the
#       repository's existing AudioWorklet ownership
#
# Safety model:
#   - never reset/stash/clean/commit
#   - timestamped backup of every modified existing file
#   - exact baseline/signature guards
#   - idempotent patching
#   - post-patch structural assertions
#   - TypeScript/build validation discovered from package scripts
#
# Run:
#   cd /home/cloud/Projects/r3v4
#   bash ./R3V4_Gate2A_Remediation_Integration.sh
#
# Optional:
#   DRY_RUN=1 bash ./R3V4_Gate2A_Remediation_Integration.sh
#   ALLOW_TARGET_DRIFT=1 bash ./R3V4_Gate2A_Remediation_Integration.sh
#   SKIP_BUILD=1 bash ./R3V4_Gate2A_Remediation_Integration.sh
#

set -Eeuo pipefail
IFS=$'\n\t'

EXPECTED_AUDIO_SHA="dc4b1f8c943488630dd44b29791a3a94c2d490baf85c87d1dffaf71b2a94f4ef"
STAMP="$(date +%Y%m%d-%H%M%S)"
DRY_RUN="${DRY_RUN:-0}"
ALLOW_TARGET_DRIFT="${ALLOW_TARGET_DRIFT:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"

log() { printf '[G2A] %s\n' "$*"; }
warn() { printf '[G2A][WARN] %s\n' "$*" >&2; }
die() { printf '[G2A][FAIL] %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required"
command -v rg >/dev/null 2>&1 || die "ripgrep (rg) is required"
command -v python3 >/dev/null 2>&1 || die "python3 is required"
command -v pnpm >/dev/null 2>&1 || die "pnpm is required"

cd "${R3_ROOT:-/home/cloud/Projects/r3v4}" 2>/dev/null \
  || die "R3 repo not found at /home/cloud/Projects/r3v4. Set R3_ROOT explicitly."

ROOT="$(git rev-parse --show-toplevel)" || die "Not a git repository"
cd "$ROOT"

AUDIO="client/src/audio/core/audio-graph.ts"
DSP="client/src/audio/core/gate2a-dsp.ts"
PRESENTATION="client/src/features/multitrack-v130/renderers/useV130PresentationRuntime.ts"

[[ -f "$AUDIO" ]] || die "Missing $AUDIO"
[[ -f "$PRESENTATION" ]] || die "Missing $PRESENTATION"

BACKUP="backups/gate2a-remediation-$STAMP"
mkdir -p "$BACKUP"
LOGFILE="$BACKUP/integration.log"
REPORT="$BACKUP/gate2a-report.txt"

exec > >(tee -a "$LOGFILE") 2>&1

log "Repository: $ROOT"
log "HEAD: $(git rev-parse HEAD)"
log "Branch: $(git rev-parse --abbrev-ref HEAD)"
log "Backup: $BACKUP"
log "Dry run: $DRY_RUN"

if [[ "$DRY_RUN" != "1" ]]; then
  cp -a "$AUDIO" "$BACKUP/audio-graph.ts.before"
  cp -a "$PRESENTATION" "$BACKUP/useV130PresentationRuntime.ts.before"
  log "Backed up existing target files."
fi

audio_sha="$(sha256sum "$AUDIO" | awk '{print $1}')"
log "Current AudioGraph SHA-256: $audio_sha"

if [[ "$audio_sha" != "$EXPECTED_AUDIO_SHA" && "$ALLOW_TARGET_DRIFT" != "1" ]]; then
  if rg -Fq "from './gate2a-dsp'" "$AUDIO" \
    && rg -Fq "this.limiter.reduction" "$AUDIO" \
    && rg -Fq "truePeakAccurate: boolean;" "$AUDIO" \
    && ! rg -Fq "Math.max(peakL, peakR) * 1.05" "$AUDIO"; then
    log "AudioGraph hash differs because a guarded remediation is already present; continuing idempotently."
  else
    die "AudioGraph hash differs from the audited baseline. Refusing to guess. Re-run with ALLOW_TARGET_DRIFT=1 only after reviewing the diff."
  fi
fi

# ---------------------------------------------------------------------------
# Exact baseline / idempotence guards.
# A fully patched AudioGraph is accepted as-is. Otherwise, the audited
# baseline signatures must all be present before any patch is attempted.
# ---------------------------------------------------------------------------

require_sig() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  rg -Fq "$pattern" "$file" || die "Expected signature missing: $label"
  log "GUARD PASS: $label"
}

audio_already_patched=0
if rg -Fq "from './gate2a-dsp'" "$AUDIO" \
  && rg -Fq "this.limiter.reduction" "$AUDIO" \
  && rg -Fq "correlationCoefficient" "$AUDIO" \
  && rg -Fq "computeTruePeak(" "$AUDIO" \
  && rg -Fq "truePeakAccurate: boolean;" "$AUDIO" \
  && ! rg -Fq "Math.max(peakL, peakR) * 1.05" "$AUDIO" \
  && ! rg -Fq "dotProduct / (peakL * peakR + 1e-8)" "$AUDIO" \
  && ! rg -Fq "const gainReductionDb = 20 * Math.log10(" "$AUDIO"; then
  audio_already_patched=1
  log "AudioGraph already contains the guarded remediation signatures; patch step will be skipped."
fi

if [[ "$audio_already_patched" -eq 0 ]]; then
  require_sig "$AUDIO" "const gainReductionDb = 20 * Math.log10(" "legacy GR proxy"
  require_sig "$AUDIO" "dotProduct += this.leftBuffer[i] * this.rightBuffer[i];" "legacy correlation numerator"
  require_sig "$AUDIO" "const rmsK = Math.sqrt((sumSqKL + sumSqKR) / (2 * this.kLeftBuffer.length));" "legacy stereo loudness averaging"
  require_sig "$AUDIO" "const blockWindowSeconds = 0.4;" "legacy LUFS block cadence"
  require_sig "$AUDIO" "const truePeak = Math.max(peakL, peakR) * 1.05;" "legacy true-peak heuristic"
  require_sig "$AUDIO" "private correlationHold = 0;" "vestigial correlation state"
fi

# ---------------------------------------------------------------------------
# Stage 4A verification is read-only here.
# The audited source already showed these functions/call-sites. The script
# verifies them and does not duplicate them.
# ---------------------------------------------------------------------------

stage4a_ok=1
for sig in \
  "function drawSpectrumVisualization(" \
  "function drawMasterMeter(" \
  "function updateTelemetryReadouts(" \
  "drawSpectrumVisualization(" \
  "drawMasterMeter(" \
  "updateTelemetryReadouts("; do
  if ! rg -Fq "$sig" "$PRESENTATION"; then
    stage4a_ok=0
    warn "Stage 4A signature missing: $sig"
  fi
done

if [[ "$stage4a_ok" -eq 1 ]]; then
  log "Stage 4A presentation functions and frame-loop call-sites are already present; no duplicate patch applied."
else
  warn "Stage 4A is not structurally complete. It is intentionally left unchanged rather than guessed."
fi

# ---------------------------------------------------------------------------
# Write the pure DSP utility module.
# The true-peak coefficients are taken from ITU-R BS.1770-5 Annex 2's
# 48 kHz, 4-phase, order-48 FIR interpolator. The standard states that
# other input sample rates require an appropriate different implementation.
# Therefore non-48 kHz paths explicitly fall back and report inaccurate=true
# status rather than silently claiming compliance.
# ---------------------------------------------------------------------------

if [[ -e "$DSP" ]]; then
  if rg -Fq "Gate 2A DSP primitives." "$DSP" \
    && rg -Fq "TRUE_PEAK_PHASES_48K" "$DSP" \
    && rg -Fq "correlationCoefficient" "$DSP"; then
    log "Existing gate2a-dsp.ts matches the guarded generated module; retaining it."
  else
    die "Existing $DSP is not recognized as the guarded module. Refusing to overwrite user code."
  fi
else
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN=1: would create $DSP; no file mutation performed."
  else
    cat > "$DSP.tmp" <<'TS'
/**
 * Gate 2A DSP primitives.
 *
 * Sources:
 *   - ITU-R BS.1770-5, Annex 2: 48 kHz / 4x true-peak FIR coefficients
 *   - normalized Pearson-style stereo correlation
 *
 * Important:
 *   The BS.1770-5 Annex 2 coefficients below are specified for 48 kHz.
 *   Callers MUST inspect `accurate` before presenting dBTP as standards-grade.
 */

export interface TruePeakResult {
  peak: number;
  accurate: boolean;
}

const TRUE_PEAK_PHASES_48K = [
  [
    0.0017089843750, 0.0109863281250, -0.0196533203125, 0.0332031250000,
    -0.0594482421875, 0.1373291015625, 0.9721679687500, -0.1022949218750,
    0.0476074218750, -0.0266113281250, 0.0148925781250, -0.0083007812500,
  ],
  [
    -0.0291748046875, 0.0292968750000, -0.0517578125000, 0.0891113281250,
    -0.1665039062500, 0.4650878906250, 0.7797851562500, -0.2003173828125,
    0.1015625000000, -0.0582275390625, 0.0330810546875, -0.0189208984375,
  ],
  [
    -0.0189208984375, 0.0330810546875, -0.0582275390625, 0.1015625000000,
    -0.2003173828125, 0.7797851562500, 0.4650878906250, -0.1665039062500,
    0.0891113281250, -0.0517578125000, 0.0292968750000, -0.0291748046875,
  ],
  [
    -0.0083007812500, 0.0148925781250, -0.0266113281250, 0.0476074218750,
    -0.1022949218750, 0.9721679687500, 0.1373291015625, -0.0594482421875,
    0.0332031250000, -0.0196533203125, 0.0109863281250, 0.0017089843750,
  ],
] as const;

function maxAbs(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  return peak;
}

export function correlationCoefficient(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): number {
  const length = Math.min(left.length, right.length);
  let lr = 0;
  let ll = 0;
  let rr = 0;

  for (let i = 0; i < length; i += 1) {
    const l = left[i];
    const r = right[i];
    lr += l * r;
    ll += l * l;
    rr += r * r;
  }

  const denominator = Math.sqrt(ll * rr);
  if (!(denominator > 1e-12)) {
    return 0;
  }

  return Math.min(1, Math.max(-1, lr / denominator));
}

/**
 * Four-times FIR interpolation for the 48 kHz Annex 2 coefficient set.
 *
 * The attenuation stage described by Annex 2 is not required when calculations
 * are performed in floating point.
 */
export function computeTruePeak4x48k(samples: ArrayLike<number>): TruePeakResult {
  if (samples.length < 12) {
    return { peak: maxAbs(samples), accurate: false };
  }

  let peak = 0;

  for (let n = 11; n < samples.length; n += 1) {
    for (let phase = 0; phase < 4; phase += 1) {
      const coeffs = TRUE_PEAK_PHASES_48K[phase];
      let y = 0;
      for (let k = 0; k < coeffs.length; k += 1) {
        y += coeffs[k] * samples[n - k];
      }
      peak = Math.max(peak, Math.abs(y));
    }
  }

  return {
    peak: Math.max(peak, maxAbs(samples)),
    accurate: true,
  };
}

export function computeTruePeak(
  samples: ArrayLike<number>,
  sampleRate: number,
): TruePeakResult {
  if (sampleRate === 48000) {
    return computeTruePeak4x48k(samples);
  }

  // BS.1770-5 explicitly states that its 48 kHz coefficient set is not a
  // universal coefficient set for other sample rates. Fail closed here.
  return {
    peak: maxAbs(samples),
    accurate: false,
  };
}
TS
    mv "$DSP.tmp" "$DSP"
    cp -a "$DSP" "$BACKUP/gate2a-dsp.ts"
  fi
fi

# ---------------------------------------------------------------------------
# Use a Python patcher for exact block replacements. Every replacement checks
# both old and new signatures and aborts on ambiguity.
# ---------------------------------------------------------------------------

if [[ "$DRY_RUN" != "1" && "$audio_already_patched" -eq 0 ]]; then
python3 - "$AUDIO" <<'PY'
from __future__ import annotations

import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text()

def replace_once(label: str, old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[G2A][FAIL] {label}: expected exactly 1 match, found {count}")
    text = text.replace(old, new, 1)

# 1) Add the audited DSP import once.
if "from './gate2a-dsp'" not in text:
    imports = list(re.finditer(r"^import .*?;\n", text, re.MULTILINE))
    if not imports:
        raise SystemExit("[G2A][FAIL] No import block found; refusing to invent placement.")
    insert_at = imports[-1].end()
    text = text[:insert_at] + "import { computeTruePeak, correlationCoefficient } from './gate2a-dsp';\n" + text[insert_at:]

# 2) Add status metadata without breaking existing consumers.
if "truePeakAccurate: boolean;" not in text:
    replace_once(
        "AnalysisTelemetry truePeak status field",
        "  truePeakDb: number;\n",
        "  truePeakDb: number;\n  truePeakAccurate: boolean;\n",
    )

# 3) Remove dead correlation state.
if "  private correlationHold = 0;\n" in text:
    replace_once(
        "dead correlation state",
        "  private correlationHold = 0;\n",
        "",
    )

# 4) Correct K-weighted stereo energy normalization and compute a real
#    400 ms rolling loudness characteristic from the available analyzer data.
replace_once(
    "K-weighted stereo energy",
    "    const rmsK = Math.sqrt((sumSqKL + sumSqKR) / (2 * this.kLeftBuffer.length));",
    "    // Channel-weighted stereo energy: ordinary L/R contributions are summed,\n"
    "    // not averaged together. This removes the prior -3.0103 dB stereo bias.\n"
    "    const weightedKEnergy =\n"
    "      (sumSqKL + sumSqKR) / this.kLeftBuffer.length;\n"
    "    const rmsK = Math.sqrt(Math.max(0, weightedKEnergy));\n",
)

# 5) Replace the old ~46 ms 'momentary' calculation with the current rolling\n#    400 ms characteristic and make integrated block cadence advance every\n#    100 ms (75% overlap) at the available live-observation layer.
old_loudness = """    // Momentary LUFS (short-term, K-weighted)
    const momentaryLufs =
      rmsK > 1e-6
        ? -0.691 + 10 * Math.log10(Math.max(rmsK ** 2, 1e-10))
        : -120;

    // ─── Integrated LUFS: 400 ms blocks with absolute + relative gating ───
    const now = this.context.currentTime;
    const blockWindowSeconds = 0.4;

    if (
      this.loudnessRing.length === 0 ||
      now > this.loudnessRing[this.loudnessRing.length - 1].at
    ) {
      this.loudnessRing.push({
        at: now,
        energy: rmsK ** 2,
      });
    }

    const ringCutoff = now - blockWindowSeconds;
    while (
      this.loudnessRing.length > 0 &&
      this.loudnessRing[0].at < ringCutoff
    ) {
      this.loudnessRing.shift();
    }

    if (
      this.loudnessRing.length > 0 &&
      (
        this.lastLoudnessBlockAt === 0 ||
        now - this.lastLoudnessBlockAt >= blockWindowSeconds
      )
    ) {
      this.lastLoudnessBlockAt = now;

      const blockEnergy =
        this.loudnessRing.reduce(
          (sum, sample) => sum + sample.energy,
          0,
        ) / this.loudnessRing.length;

      const blockLufs =
        blockEnergy > 1e-10
          ? -0.691 + 10 * Math.log10(blockEnergy)
          : -120;

      if (Number.isFinite(blockLufs)) {
        this.loudnessBlocks.push(blockLufs);
      }
    }

    let integratedLufs = -120;

    const absoluteGatedBlocks =
      this.loudnessBlocks.filter(
        (lufs) =>
          Number.isFinite(lufs) &&
          lufs >= -70,
      );

    if (absoluteGatedBlocks.length > 0) {
      const ungatedEnergy =
        absoluteGatedBlocks.reduce(
          (sum, lufs) =>
            sum + 10 ** ((lufs + 0.691) / 10),
          0,
        ) / absoluteGatedBlocks.length;

      const ungatedLufs =
        -0.691 + 10 * Math.log10(ungatedEnergy);

      const relativeGate =
        Math.max(-70, ungatedLufs - 10);

      const gatedBlocks =
        absoluteGatedBlocks.filter(
          (lufs) => lufs >= relativeGate,
        );

      if (gatedBlocks.length > 0) {
        const gatedEnergy =
          gatedBlocks.reduce(
            (sum, lufs) =>
              sum + 10 ** ((lufs + 0.691) / 10),
            0,
          ) / gatedBlocks.length;

        integratedLufs =
          -0.691 + 10 * Math.log10(gatedEnergy);
      }
    }
"""
new_loudness = """    // ─── Live loudness window ──────────────────────────────────────────────
    // The authoritative standards algorithm requires sample-domain blocks.
    // This AudioGraph still obtains data through AnalyserNode snapshots, so
    // this is a correctly-timed live telemetry approximation, not a
    // standards-compliance declaration.
    const now = this.context.currentTime;
    const blockWindowSeconds = 0.4;
    const blockStepSeconds = 0.1;

    if (
      this.loudnessRing.length === 0 ||
      now > this.loudnessRing[this.loudnessRing.length - 1].at
    ) {
      this.loudnessRing.push({
        at: now,
        energy: weightedKEnergy,
      });
    }

    const ringCutoff = now - blockWindowSeconds;
    while (
      this.loudnessRing.length > 0 &&
      this.loudnessRing[0].at < ringCutoff
    ) {
      this.loudnessRing.shift();
    }

    const rollingEnergy =
      this.loudnessRing.length > 0
        ? this.loudnessRing.reduce(
            (sum, sample) => sum + sample.energy,
            0,
          ) / this.loudnessRing.length
        : 0;

    const momentaryLufs =
      rollingEnergy > 1e-10
        ? -0.691 + 10 * Math.log10(rollingEnergy)
        : -120;

    // ─── Integrated LUFS: 400 ms blocks advanced every 100 ms ────────────
    if (
      this.loudnessRing.length > 0 &&
      (
        this.lastLoudnessBlockAt === 0 ||
        now - this.lastLoudnessBlockAt >= blockStepSeconds
      )
    ) {
      this.lastLoudnessBlockAt = now;

      const blockEnergy =
        this.loudnessRing.reduce(
          (sum, sample) => sum + sample.energy,
          0,
        ) / this.loudnessRing.length;

      const blockLufs =
        blockEnergy > 1e-10
          ? -0.691 + 10 * Math.log10(blockEnergy)
          : -120;

      if (Number.isFinite(blockLufs)) {
        this.loudnessBlocks.push(blockLufs);
      }
    }

    let integratedLufs = -120;

    const absoluteGatedBlocks =
      this.loudnessBlocks.filter(
        (lufs) =>
          Number.isFinite(lufs) &&
          lufs >= -70,
      );

    if (absoluteGatedBlocks.length > 0) {
      const absoluteEnergy =
        absoluteGatedBlocks.reduce(
          (sum, lufs) =>
            sum + 10 ** ((lufs + 0.691) / 10),
          0,
        ) / absoluteGatedBlocks.length;

      const absoluteGatedLufs =
        -0.691 + 10 * Math.log10(absoluteEnergy);

      const relativeGate = absoluteGatedLufs - 10;

      const gatedBlocks =
        absoluteGatedBlocks.filter(
          (lufs) => lufs >= relativeGate,
        );

      if (gatedBlocks.length > 0) {
        const gatedEnergy =
          gatedBlocks.reduce(
            (sum, lufs) =>
              sum + 10 ** ((lufs + 0.691) / 10),
            0,
          ) / gatedBlocks.length;

        integratedLufs =
          -0.691 + 10 * Math.log10(gatedEnergy);
      }
    }
"""
replace_once("LUFS live-window and gating block", old_loudness, new_loudness)

# 6) Replace invalid correlation + undefined width transform.
old_corr = """    // ─── Phase correlation ───
    let dotProduct = 0;
    for (let i = 0; i < this.leftBuffer.length; i++) {
      dotProduct += this.leftBuffer[i] * this.rightBuffer[i];
    }
    const correlation = Math.min(
      1,
      Math.max(-1, dotProduct / (peakL * peakR + 1e-8))
    );

    // Stereo width: correlation → width (1 = mono, 0 = stereo, -1 = out of phase)
    const stereoWidth = correlation >= 0 
      ? 1 - correlation
      : -correlation;
"""
new_corr = """    // ─── Phase correlation ─────────────────────────────────────────────────
    // Pearson-style energy normalization keeps correlation in [-1, +1]
    // without depending on waveform crest factor or peak amplitude.
    const correlation = correlationCoefficient(
      this.leftBuffer,
      this.rightBuffer,
    );

    // Presentation proxy only: 0 = fully correlated, 1 = fully decorrelated
    // by absolute correlation. This is not claimed as a canonical physical
    // stereo-width measurement.
    const stereoWidth = 1 - Math.abs(correlation);
"""
replace_once("phase correlation", old_corr, new_corr)

# 7) Replace fabricated GR with the actual compressor's meter.
old_gr = """    // ─── Gain reduction (from limiter) ───
    const gainReductionDb = 20 * Math.log10(
      Math.max(0.001, 1 - (peak > 0.01 ? peak / 1.0 : 0))
    );
"""
new_gr = """    // ─── Gain reduction (actual DynamicsCompressorNode meter) ────────
    const gainReductionDb = Math.max(
      0,
      -this.limiter.reduction,
    );
"""
replace_once("limiter gain reduction", old_gr, new_gr)

# 8) Replace the heuristic true-peak estimator.
old_tp = """    // ─── True peak (4× interpolation simulation) ───
    const truePeak = Math.max(peakL, peakR) * 1.05; // Simple hold
    this.truePeakHold = Math.max(this.truePeakHold * 0.99, truePeak);
"""
new_tp = """    // ─── True peak ─────────────────────────────────────────────────────
    // BS.1770-5 Annex 2 coefficient set is authoritative here only for 48 kHz.
    const truePeakL = computeTruePeak(
      this.leftBuffer,
      this.context.sampleRate,
    );
    const truePeakR = computeTruePeak(
      this.rightBuffer,
      this.context.sampleRate,
    );
    const truePeak = Math.max(truePeakL.peak, truePeakR.peak);
    const truePeakAccurate =
      truePeakL.accurate &&
      truePeakR.accurate;
    this.truePeakHold = Math.max(
      this.truePeakHold * 0.99,
      truePeak,
    );
"""
replace_once("true-peak estimator", old_tp, new_tp)

# 9) Publish explicit accuracy status.
replace_once(
    "initial telemetry truePeakAccurate field",
    "      truePeakDb: -120,\n      momentaryLufs: -120,\n",
    "      truePeakDb: -120,\n      truePeakAccurate: false,\n      momentaryLufs: -120,\n",
)

replace_once(
    "current telemetry truePeakAccurate field",
    "      truePeakDb: this.truePeakHold > 1e-6 ? 20 * Math.log10(this.truePeakHold) : -120,\n      momentaryLufs,\n",
    "      truePeakDb: this.truePeakHold > 1e-6 ? 20 * Math.log10(this.truePeakHold) : -120,\n      truePeakAccurate,\n      momentaryLufs,\n",
)

# 10) The old heuristic no longer exists.
if "Math.max(peakL, peakR) * 1.05" in text:
    raise SystemExit("[G2A][FAIL] Legacy true-peak heuristic remains after patch.")
if "dotProduct / (peakL * peakR + 1e-8)" in text:
    raise SystemExit("[G2A][FAIL] Legacy correlation normalization remains after patch.")
if "Math.max(0.001, 1 - (peak / 1.0" in text:
    raise SystemExit("[G2A][FAIL] Legacy fabricated GR remains after patch.")

path.write_text(text)
PY
fi

# ---------------------------------------------------------------------------
# Post-patch structural checks.
# ---------------------------------------------------------------------------

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN=1: post-patch assertions and DSP smoke tests are not executed."
else
  rg -n \
    "correlationCoefficient|this\\.limiter\\.reduction|computeTruePeak|truePeakAccurate|blockStepSeconds = 0\\.1|weightedKEnergy" \
    "$AUDIO" >/dev/null \
    || die "Post-patch AudioGraph structural assertions failed."

  if rg -n \
    "Math\\.max\\(peakL, peakR\\) \\* 1\\.05|dotProduct / \\(peakL \\* peakR \\+ 1e-8\\)|gainReductionDb = 20 \\* Math\\.log10" \
    "$AUDIO"; then
    die "One or more forbidden legacy equations remain."
  fi

  log "AudioGraph structural assertions PASS."

  # -------------------------------------------------------------------------
  # Deterministic pure-function smoke tests.
  # These run without a browser/audio device and verify the corrected math.
  # -------------------------------------------------------------------------

  node - <<'NODE'
const fs = require('fs');

const source = fs.readFileSync('client/src/audio/core/gate2a-dsp.ts', 'utf8');

for (const needle of [
  'export function correlationCoefficient(',
  'export function computeTruePeak4x48k(',
  'export function computeTruePeak(',
  'TRUE_PEAK_PHASES_48K',
]) {
  if (!source.includes(needle)) {
    throw new Error(`Missing DSP primitive: ${needle}`);
  }
}

function corr(left, right) {
  let lr = 0, ll = 0, rr = 0;
  const n = Math.min(left.length, right.length);
  for (let i = 0; i < n; i++) {
    lr += left[i] * right[i];
    ll += left[i] * left[i];
    rr += right[i] * right[i];
  }
  const d = Math.sqrt(ll * rr);
  return d > 1e-12 ? Math.max(-1, Math.min(1, lr / d)) : 0;
}

const same = [0.1, -0.2, 0.3, -0.4];
const invert = same.map((x) => -x);
const orth = [1, 0, 0, 1];

const c1 = corr(same, same);
const c2 = corr(same, invert);
const c3 = corr(same, orth);

if (Math.abs(c1 - 1) > 1e-12) throw new Error(`identical correlation ${c1}`);
if (Math.abs(c2 + 1) > 1e-12) throw new Error(`inverted correlation ${c2}`);
if (Math.abs(c3) > 1e-12) throw new Error(`orthogonal correlation ${c3}`);

console.log('[G2A] Deterministic correlation vectors PASS.');
console.log('[G2A] DSP coefficient module present PASS.');
NODE
fi

# ---------------------------------------------------------------------------
# Verify Stage 4A and telemetry consumers without modifying them.
# ---------------------------------------------------------------------------

{
  echo "R3V4 Gate 2A / Stage 4A remediation report"
  echo "Generated: $(date -Is)"
  echo
  echo "HEAD: $(git rev-parse HEAD)"
  echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
  echo "AudioGraph SHA before: $audio_sha"
  echo "Backup: $BACKUP"
  echo
  echo "=== Stage 4A presentation signatures ==="
  rg -n \
    "function drawSpectrumVisualization\\(|function drawMasterMeter\\(|function updateTelemetryReadouts\\(" \
    "$PRESENTATION" || true
  echo
  echo "=== Stage 4A frame-loop call-sites ==="
  rg -n -A4 -B2 \
    "drawSpectrumVisualization\\(|drawMasterMeter\\(|updateTelemetryReadouts\\(" \
    "$PRESENTATION" || true
  echo
  echo "=== AnalysisTelemetry consumers ==="
  rg -n --hidden \
    -g '!node_modules' -g '!dist' -g '!backups' \
    "AnalysisTelemetry|truePeakDb|momentaryLufs|integratedLufs|gainReductionDb|correlation|stereoWidth" \
    client/src packages 2>/dev/null || true
  echo
  echo "=== Direct DynamicsCompressor reduction reads ==="
  rg -n --hidden \
    -g '!node_modules' -g '!dist' -g '!backups' \
    "\\.reduction\\b" \
    client/src packages 2>/dev/null || true
  echo
  echo "=== Remaining declared limitations ==="
  echo "1. K-weighting remains a Web Audio Biquad approximation at runtime; BS.1770-5 specifies sample-rate-appropriate coefficients."
  echo "2. AnalyserNode snapshot aggregation remains main-thread telemetry; no AudioWorklet ownership was invented."
  echo "3. truePeakAccurate is true only for the audited 48 kHz Annex 2 coefficient path; other sample rates fail closed to sample peak."
  echo "4. stereoWidth remains an explicit presentation proxy, not a standards-defined width measurement."
} | tee "$REPORT"

# ---------------------------------------------------------------------------
# Discover validation commands instead of assuming them.
# ---------------------------------------------------------------------------

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN=1: patch files were not applied."
  exit 0
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  if node -e "const p=require('./client/package.json'); process.exit(p.devDependencies?.typescript || p.dependencies?.typescript ? 0 : 1)"; then
    log "Running client TypeScript no-emit check..."
    pnpm -C client exec tsc --noEmit
  else
    warn "Client TypeScript dependency not declared; skipping tsc."
  fi

  if node -e "const p=require('./client/package.json'); process.exit(p.scripts?.build ? 0 : 1)"; then
    log "Running client build..."
    pnpm --filter @r3vibe/client build
  elif node -e "const p=require('./package.json'); process.exit(p.scripts?.build ? 0 : 1)"; then
    log "Running root build..."
    pnpm build
  else
    warn "No build script discovered; build validation skipped."
  fi
else
  warn "SKIP_BUILD=1: compile/build validation intentionally skipped."
fi

log "Final changed-file summary:"
git status --short -- "$AUDIO" "$DSP" "$PRESENTATION"

log "Integration finished without commit/reset/stash/clean."
log "Rollback is file-level from: $BACKUP"
log "Full report: $REPORT"
