// FILE: client/src/audio/fx/Compressor.ts
import { FXNodeBase } from './fx-nodebase';
import { smoothParam } from '../../utils/audio-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompressorParams {
  /** dBFS. Range: -100 → 0. Default: -24 */
  threshold:   number;
  /** dB range above threshold where soft-knee kicks in. Range: 0 → 40. Default: 6 */
  knee:        number;
  /** Compression ratio. Range: 1 → 20. Default: 4 */
  ratio:       number;
  /** Attack time in seconds. Range: 0 → 1. Default: 0.003 */
  attack:      number;
  /** Release time in seconds. Range: 0 → 1. Default: 0.25 */
  release:     number;
  /** Post-compression gain in dB. Range: 0 → 40. Default: 0 */
  makeupGain:  number;
  /** Dry/wet mix 0–1. Default: 1 (fully wet) */
  mix:         number;
}

export type CompressorPresetName =
  | 'gentle'
  | 'vocal'
  | 'drum-bus'
  | 'mastering'
  | 'limiting'
  | 'punch';

export type CompressorEventMap = {
  paramsChanged: { compressor: Compressor; params: CompressorParams };
  bypassed:      { compressor: Compressor; bypassed: boolean };
  disposed:      { compressor: Compressor };
};

type Listener<K extends keyof CompressorEventMap> = (
  payload: CompressorEventMap[K],
) => void;

// ─── Presets ──────────────────────────────────────────────────────────────────

export const COMPRESSOR_PRESETS: Record<CompressorPresetName, CompressorParams> = {
  gentle: {
    threshold: -18, knee: 10, ratio: 2,
    attack: 0.01,   release: 0.3,  makeupGain: 2,   mix: 1,
  },
  vocal: {
    threshold: -20, knee: 6,  ratio: 4,
    attack: 0.005,  release: 0.15, makeupGain: 4,   mix: 1,
  },
  'drum-bus': {
    threshold: -16, knee: 4,  ratio: 6,
    attack: 0.002,  release: 0.1,  makeupGain: 3,   mix: 0.8,
  },
  mastering: {
    threshold: -10, knee: 12, ratio: 2,
    attack: 0.03,   release: 0.5,  makeupGain: 1,   mix: 1,
  },
  limiting: {
    threshold: -1,  knee: 0,  ratio: 20,
    attack: 0.001,  release: 0.05, makeupGain: 0,   mix: 1,
  },
  punch: {
    threshold: -22, knee: 3,  ratio: 8,
    attack: 0.001,  release: 0.08, makeupGain: 5,   mix: 1,
  },
};

// ─── Compressor ───────────────────────────────────────────────────────────────

export class Compressor extends FXNodeBase {
  private comp:       DynamicsCompressorNode;
  private makeupNode: GainNode;
  /** Separate sidechain input — connect external triggers here */
  readonly sidechainInput: GainNode;

  private _params: CompressorParams = {
    threshold:  -24,
    knee:         6,
    ratio:        4,
    attack:    0.003,
    release:   0.25,
    makeupGain:   0,
    mix:          1,
  };

  private readonly listeners: {
    [K in keyof CompressorEventMap]?: Set<Listener<K>>;
  } = {};

  // ─── Constructor ────────────────────────────────────────────────────────────

  constructor(id: string, initialParams?: Partial<CompressorParams>) {
    super(id);

    this.comp       = this.context.createDynamicsCompressor();
    this.makeupNode = this.context.createGain();

    // Sidechain input — feeds the compressor detection circuit.
    // On most browsers Web Audio does not expose a true sidechain, so we
    // connect it in parallel with the main signal. A true sidechain would
    // require an AudioWorklet processor.
    this.sidechainInput = this.context.createGain();
    this.sidechainInput.gain.setTargetAtTime(0, this.context.currentTime, 0.015); // silent — influences detection only

    if (initialParams) {
      this._params = { ...this._params, ...initialParams };
    }

    this.applyAllParams(false); // apply without ramping on init
    this.connectEffect();
  }

  // ─── Graph ───────────────────────────────────────────────────────────────────

  /**
   * input → comp → makeupGain → wetGain → output
   *                                      ↑
   * input ────────── dryGain ────────────┘  (handled by FXNodeBase mix)
   */
  protected connectEffect(): void {
    this.input.connect(this.comp);
    this.sidechainInput.connect(this.comp); // detection input
    this.comp.connect(this.makeupNode);
    this.makeupNode.connect(this.wetGain);
    this.wetGain.connect(this.output);
  }

  // ─── Params ──────────────────────────────────────────────────────────────────

  get params(): Readonly<CompressorParams> { return { ...this._params }; }

  /**
   * Update one or more parameters. All changes are ramped smoothly.
   */
  setParams(updates: Partial<CompressorParams>): this {
    this._params = { ...this._params, ...updates };
    this.applyAllParams(true);
    this.emit('paramsChanged', { compressor: this, params: this.params });
    return this;
  }

  /** Apply a named preset. */
  applyPreset(name: CompressorPresetName): this {
    return this.setParams(COMPRESSOR_PRESETS[name]);
  }

  // Individual setters — kept for backward compat and convenience

  setThreshold(db: number): this {
    return this.setParams({ threshold: db });
  }

  setKnee(db: number): this {
    return this.setParams({ knee: db });
  }

  setRatio(value: number): this {
    return this.setParams({ ratio: value });
  }

  setAttack(seconds: number): this {
    return this.setParams({ attack: seconds });
  }

  setRelease(seconds: number): this {
    return this.setParams({ release: seconds });
  }

  /** Post-compression makeup gain in dB (0 = unity). */
  setMakeupGain(db: number): this {
    return this.setParams({ makeupGain: db });
  }

  /** Dry/wet mix: 0 = fully dry, 1 = fully compressed. */
  setMix(value: number): this {
    return this.setParams({ mix: clamp(value, 0, 1) });
  }

  // ─── Metering ────────────────────────────────────────────────────────────────

  /**
   * Current gain reduction in dB (always ≤ 0).
   * A value of −6 means the compressor is attenuating by 6 dB.
   */
  getReduction(): number {
    return this.comp.reduction;
  }

  /**
   * Gain reduction expressed as a 0–1 ratio for easy UI meter display.
   * 0 = no reduction, 1 = maximum reduction (based on ratio + threshold).
   */
  getReductionNormalized(): number {
    // comp.reduction is in dB (≤ 0); clamp to a useful range of 0–40 dB
    return clamp(-this.comp.reduction / 40, 0, 1);
  }

  // ─── Bypass ──────────────────────────────────────────────────────────────────

  /** Override FXNodeBase.setBypass to also emit our own event. */
  setBypass(bypassed: boolean): void {
    super.setBypass(bypassed);
    this.emit('bypassed', { compressor: this, bypassed });
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  toJSON() {
    return {
      id:      this.id,
      type:    'Compressor',
      bypassed: this.bypassed,
      params:  this.params,
    };
  }

  static fromJSON(data: ReturnType<Compressor['toJSON']>): Compressor {
    const c = new Compressor(data.id, data.params);
    if (data.bypassed) c.setBypass(true);
    return c;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  dispose(): void {
    try { this.comp.disconnect();        } catch { /* ok */ }
    try { this.makeupNode.disconnect();  } catch { /* ok */ }
    try { this.sidechainInput.disconnect(); } catch { /* ok */ }
    super.dispose();
    this.emit('disposed', { compressor: this });
  }

  // ─── Event emitter ────────────────────────────────────────────────────────────

  on<K extends keyof CompressorEventMap>(event: K, listener: Listener<K>): this {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = new Set();
    }
    (this.listeners[event] as Set<Listener<K>>).add(listener);
    return this;
  }

  off<K extends keyof CompressorEventMap>(event: K, listener: Listener<K>): this {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(listener);
    return this;
  }

  once<K extends keyof CompressorEventMap>(event: K, listener: Listener<K>): this {
    const wrapper: Listener<K> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  private emit<K extends keyof CompressorEventMap>(
    event: K,
    payload: CompressorEventMap[K],
  ): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.forEach((fn) =>
      fn(payload),
    );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Push all current params to the Web Audio nodes.
   * `ramp = false` during construction to avoid scheduling before graph exists.
   */
  private applyAllParams(ramp: boolean): void {
    const t   = this.context.currentTime;
    const tau = 0.015; // 15 ms exponential time constant

    const apply = (param: AudioParam, value: number) => {
      if (ramp) {
        smoothParam(param, value, t, tau);
      } else {
        param.setValueAtTime(value, t);
      }
    };

    apply(this.comp.threshold, this._params.threshold);
    apply(this.comp.knee,      this._params.knee);
    apply(this.comp.ratio,     this._params.ratio);
    apply(this.comp.attack,    this._params.attack);
    apply(this.comp.release,   this._params.release);

    // Makeup gain: convert dB → linear
    const makeupLinear = dbToLinear(this._params.makeupGain);
    apply(this.makeupNode.gain, makeupLinear);

    // Mix — FXNodeBase exposes wetGain/dryGain
    if (ramp) {
      smoothParam(this.wetGain.gain, this._params.mix,              t, tau);
      smoothParam(this.dryGain.gain, 1 - this._params.mix,          t, tau);
    } else {
      this.wetGain.gain.setValueAtTime(this._params.mix,            t);
      this.dryGain.gain.setValueAtTime(1 - this._params.mix,        t);
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}