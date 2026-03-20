/**
 * instrument-processor.worklet.ts — AudioWorkletProcessor  (M/S Edition)
 *
 * Full mid/side processing chain in the audio thread:
 *
 *   Stereo in → M/S decode → [mid chain] + [side chain] → M/S re-encode → Stereo out
 *
 * M/S matrix:
 *   mid  = (L + R) * 0.5     — centre / mono-compatible content
 *   side = (L - R) * 0.5     — stereo difference / width
 *   L'   = mid + side
 *   R'   = mid - side
 *
 * Parameters (all a-rate):
 *   masterGain      0–2,    default 1.0   — post-processing output level
 *   compThreshold  -60–0,   default -24   — soft-knee threshold (dBFS)
 *   compRatio       1–20,   default 4     — compression ratio N:1 (shared M+S)
 *   msWidth         0–2,    default 1.0   — stereo width scalar on Side channel
 *                                           0 = mono, 1 = unity stereo, 2 = extra wide
 *   midGain         0–2,    default 1.0   — independent gain on Mid channel
 *   sideGain        0–2,    default 1.0   — independent gain on Side channel (stacks with msWidth)
 *   midThreshold   -60–0,   default -24   — separate compressor threshold for Mid
 *   sideThreshold  -60–0,   default -30   — separate compressor threshold for Side
 *                                           (Side usually needs tighter control than Mid)
 *
 * Registration: 'instrument-processor'  (same name — no changes needed at call sites)
 *
 * MONO FALLBACK:
 *   If input has only 1 channel, M/S degrades gracefully to mono processing
 *   with just gain + compression (side = 0, out L = out R = processed mid).
 */

class InstrumentProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      // Master output
      { name: 'masterGain',      defaultValue: 1.0,  minValue: 0,   maxValue: 2.0  },

      // Shared compressor (applied to each M/S channel)
      { name: 'compThreshold',   defaultValue: -24,  minValue: -60, maxValue: 0    },
      { name: 'compRatio',       defaultValue: 4,    minValue: 1,   maxValue: 20   },

      // M/S width and independent channel gains
      { name: 'msWidth',         defaultValue: 1.0,  minValue: 0,   maxValue: 2.0  },
      { name: 'midGain',         defaultValue: 1.0,  minValue: 0,   maxValue: 2.0  },
      { name: 'sideGain',        defaultValue: 1.0,  minValue: 0,   maxValue: 2.0  },

      // Per-channel compression thresholds
      { name: 'midThreshold',    defaultValue: -24,  minValue: -60, maxValue: 0    },
      { name: 'sideThreshold',   defaultValue: -30,  minValue: -60, maxValue: 0    },
    ];
  }

  // Compressor state per channel (simple soft-knee single-pole)
  private _midEnvelope  = 1.0;
  private _sideEnvelope = 1.0;

  // IIR attack/release time constants at 128-sample block rate
  private readonly _attackCoeff  = Math.exp(-1 / (0.003  * sampleRate / 128));
  private readonly _releaseCoeff = Math.exp(-1 / (0.150  * sampleRate / 128));

  /** Soft-knee gain-computer — returns linear gain reduction multiplier */
  private _compress(
    envelope:    number,
    sample:      number,
    threshDB:    number,
    ratio:       number,
  ): number {
    const thresh  = Math.pow(10, threshDB / 20);
    const abs     = Math.abs(sample);

    // Update peak envelope with attack/release
    const target  = abs;
    this._midEnvelope = target > envelope
      ? this._attackCoeff  * envelope + (1 - this._attackCoeff)  * target
      : this._releaseCoeff * envelope + (1 - this._releaseCoeff) * target;

    // Gain computer: unity below threshold, compressed above
    if (abs <= thresh) return 1.0;
    // Soft knee over 6 dB
    const kneeWidth = 0.5; // linear — knee range = thresh * [0.5, 1.5]
    const excess    = abs - thresh;
    const knee      = thresh * kneeWidth;
    if (excess < knee) {
      // Transition region — interpolate ratio 1→ratio over the knee
      const blend = excess / knee;   // 0→1
      const effectiveRatio = 1 + (ratio - 1) * blend * 0.5;
      return (thresh + excess / effectiveRatio) / abs;
    }
    return (thresh + excess / ratio) / abs;
  }

  process(
    inputs:     Float32Array[][],
    outputs:    Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const input  = inputs[0];
    const output = outputs[0];
    if (!input?.length || !output?.length) return true;

    // ── Read parameters (a-rate: per-sample arrays, or k-rate: length 1) ────
    const pGet = (name: string, i: number): number => {
      const arr = parameters[name];
      return arr ? (arr.length > 1 ? arr[i] : arr[0]) : 1.0;
    };

    const L   = input[0];
    const R   = input[1] ?? input[0];   // mono fallback: R = L
    const oL  = output[0];
    const oR  = output[1] ?? output[0];
    const len = L.length;

    for (let i = 0; i < len; i++) {
      const masterGain    = pGet('masterGain',    i);
      const compThreshold = pGet('compThreshold', i);  // shared fallback
      const compRatio     = pGet('compRatio',     i);
      const msWidth       = pGet('msWidth',       i);
      const midGainVal    = pGet('midGain',       i);
      const sideGainVal   = pGet('sideGain',      i);
      const midThresh     = pGet('midThreshold',  i);
      const sideThresh    = pGet('sideThreshold', i);

      // ── M/S encode ───────────────────────────────────────────────────────
      const mid  = (L[i] + R[i]) * 0.5;
      const side = (L[i] - R[i]) * 0.5;

      // ── Mid channel: gain + compression ──────────────────────────────────
      const midGR   = this._compress(this._midEnvelope,  mid,  midThresh  !== -24 ? midThresh  : compThreshold, compRatio);
      let procMid   = mid  * midGR  * midGainVal;

      // ── Side channel: width scaling + gain + compression ─────────────────
      const sideGR  = this._compress(this._sideEnvelope, side, sideThresh !== -30 ? sideThresh : compThreshold, compRatio);
      let procSide  = side * sideGR * msWidth * sideGainVal;

      // ── M/S decode → stereo out ───────────────────────────────────────────
      oL[i] = (procMid + procSide) * masterGain;
      oR[i] = (procMid - procSide) * masterGain;
    }

    return true;
  }
}

registerProcessor('instrument-processor', InstrumentProcessor);
