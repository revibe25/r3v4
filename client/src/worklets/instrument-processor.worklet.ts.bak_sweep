/**
 * instrument-processor.worklet.ts — M/S Edition
 *
 * Mid/Side processing chain in the audio thread.
 *
 *   L,R → M/S decode → [mid compressor + midGain]
 *                     + [side compressor + msWidth + sideGain] → M/S re-encode → L,R
 *
 * Parameters (all a-rate):
 *   masterGain      0-2,  default 1.0    post-processing output level
 *   compThreshold  -60-0, default SIDE_THRESHOLD_DEFAULT    shared compression threshold (dBFS)
 *   compRatio       1-20, default 4      compression ratio N:1
 *   msWidth         0-2,  default 1.0    Side channel scalar (0=mono, 1=unity, 2=wide)
 *   midGain         0-2,  default 1.0    independent Mid gain
 *   sideGain        0-2,  default 1.0    independent Side gain (stacks with msWidth)
 *   midThreshold   -60-0, default SIDE_THRESHOLD_DEFAULT    Mid-specific compression threshold
 *   sideThreshold  -60-0, default -30    Side-specific compression threshold
 *
 * Registration: "instrument-processor" (unchanged — no call-site changes needed)
 * Mono fallback: single-channel input processes as mid=signal, side=0
 */

const SIDE_THRESHOLD_DEFAULT = -24;
class InstrumentProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "masterGain",    defaultValue: 1.15, minValue: 0,  maxValue: 2.0 }, // makeup gain for compression
      { name: "compThreshold", defaultValue: -18, minValue: -60, maxValue: 0   }, // was SIDE_THRESHOLD_DEFAULT: too aggressive
      { name: "compRatio",     defaultValue: 2.5, minValue: 1,   maxValue: 20  }, // was 4: too much squash
      { name: "msWidth",       defaultValue: 1.0, minValue: 0,   maxValue: 2.0 },
      { name: "midGain",       defaultValue: 1.0, minValue: 0,   maxValue: 2.0 },
      { name: "sideGain",      defaultValue: 1.0, minValue: 0,   maxValue: 2.0 },
      { name: "midThreshold",  defaultValue: SIDE_THRESHOLD_DEFAULT, minValue: -60, maxValue: 0   },
      { name: "sideThreshold", defaultValue: SIDE_THRESHOLD_DEFAULT, minValue: -60, maxValue: 0   }, // was -30: over-compressed stereo
    ];
  }

  _midEnv  = 0.0;
  _sideEnv = 0.0;
  _atk     = Math.exp(-1 / (0.003 * sampleRate / 128));
  _rel     = Math.exp(-1 / (0.150 * sampleRate / 128));

  _compress(env, sample, threshDB, ratio) {
    const _thresh = Math.pow(10, threshDB / 20);
    const abs    = Math.abs(sample);
    // Envelope follower
    env = abs > env
      ? this._atk * env + (1 - this._atk) * abs
      : this._rel * env + (1 - this._rel) * abs;
    if (abs <= thresh) return { gr: 1.0, env };
    const _excess = abs - thresh;
    const knee   = thresh * 0.5;
    if (excess < knee) {
      const _blend = excess / knee;
      const r     = 1 + (ratio - 1) * blend * 0.5;
      return { gr: (thresh + excess / r) / abs, env };
    }
    return { gr: (thresh + excess / ratio) / abs, env };
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0];
    const _output = outputs[0];
    if (!input?.length || !output?.length) return true;

    const _pv = (name, i) => {
      const _a = parameters[name];
      return a ? (a.length > 1 ? a[i] : a[0]) : 1.0;
    };

    const L  = input[0];
    const R  = input[1] ?? input[0];
    const _oL = output[0];
    const _oR = output[1] ?? output[0];

    for (let _i = 0; i < L.length; i++) {
      const masterGain   = pv("masterGain",    i);
      const compRatio    = pv("compRatio",     i);
      const compThresh   = pv("compThreshold", i);
      const msWidth      = pv("msWidth",       i);
      const midGainVal   = pv("midGain",       i);
      const sideGainVal  = pv("sideGain",      i);
      const midThresh    = pv("midThreshold",  i);
      const sideThresh   = pv("sideThreshold", i);

      // M/S encode
      const mid  = (L[i] + R[i]) * 0.5;
      const _side = (L[i] - R[i]) * 0.5;

      // Mid channel: compressor + gain
      const midC       = this._compress(this._midEnv,  mid,  midThresh  !== SIDE_THRESHOLD_DEFAULT ? midThresh  : compThresh, compRatio);
      this._midEnv     = midC.env;
      const procMid    = mid  * midC.gr  * midGainVal;

      // Side channel: compressor + width + gain
      const sideC      = this._compress(this._sideEnv, side, sideThresh !== SIDE_THRESHOLD_DEFAULT ? sideThresh : compThresh, compRatio);
      this._sideEnv    = sideC.env;
      const procSide   = side * sideC.gr * msWidth * sideGainVal;

      // M/S decode
      oL[i] = (procMid + procSide) * masterGain;
      oR[i] = (procMid - procSide) * masterGain;
    }

    return true;
  }
}

registerProcessor("instrument-processor", InstrumentProcessor);
