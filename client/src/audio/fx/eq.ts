// FILE: client/src/audio/fx/eq.ts
import { FXNodeBase } from './fx-nodebase';
import { smoothParam } from '../../utils/audio-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EQBandType =
  | 'highpass'
  | 'lowshelf'
  | 'peaking'
  | 'highshelf'
  | 'lowpass'
  | 'notch';

export interface EQBandConfig {
  type:      EQBandType;
  frequency: number;   // Hz
  gain:      number;   // dB  (ignored for highpass / lowpass / notch)
  Q:         number;   // resonance / bandwidth
  enabled:   boolean;
}

export interface EQConfig {
  subBand:  EQBandConfig;
  lowBand:  EQBandConfig;
  midBand:  EQBandConfig;
  highBand: EQBandConfig;
  airBand:  EQBandConfig;
}

export type EQBand = keyof EQConfig;

export type EQEventMap = {
  bandChanged: { band: EQBand; config: EQBandConfig };
  presetLoaded:{ name: string; config: EQConfig };
  bypassed:    { bypassed: boolean };
};

type Listener<K extends keyof EQEventMap> = (payload: EQEventMap[K]) => void;

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULTS: EQConfig = {
  subBand:  { type: 'highpass',  frequency:   80, gain:  0, Q: 0.7, enabled: true },
  lowBand:  { type: 'lowshelf',  frequency:  200, gain:  0, Q: 1.0, enabled: true },
  midBand:  { type: 'peaking',   frequency: 1000, gain:  0, Q: 1.0, enabled: true },
  highBand: { type: 'highshelf', frequency: 5000, gain:  0, Q: 1.0, enabled: true },
  airBand:  { type: 'peaking',   frequency:12000, gain:  0, Q: 0.7, enabled: true },
};

// ─── Presets ──────────────────────────────────────────────────────────────────

export const EQ_PRESETS: Record<string, EQConfig> = {
  flat: DEFAULTS,

  warmVocals: {
    subBand:  { type: 'highpass',  frequency:  100, gain:   0, Q: 0.7, enabled: true },
    lowBand:  { type: 'lowshelf',  frequency:  250, gain:   3, Q: 1.0, enabled: true },
    midBand:  { type: 'peaking',   frequency: 2500, gain:  -2, Q: 1.2, enabled: true },
    highBand: { type: 'highshelf', frequency: 6000, gain:   2, Q: 1.0, enabled: true },
    airBand:  { type: 'peaking',   frequency:12000, gain:   1, Q: 0.7, enabled: true },
  },

  kickDrum: {
    subBand:  { type: 'highpass',  frequency:   30, gain:   0, Q: 0.7, enabled: true },
    lowBand:  { type: 'peaking',   frequency:   80, gain:   6, Q: 1.5, enabled: true },
    midBand:  { type: 'peaking',   frequency:  400, gain:  -4, Q: 1.0, enabled: true },
    highBand: { type: 'peaking',   frequency: 4000, gain:   3, Q: 1.0, enabled: true },
    airBand:  { type: 'highshelf', frequency: 8000, gain:  -2, Q: 1.0, enabled: true },
  },

  telephoneEffect: {
    subBand:  { type: 'highpass',  frequency:  300, gain:   0, Q: 1.5, enabled: true },
    lowBand:  { type: 'peaking',   frequency:  700, gain:   6, Q: 2.0, enabled: true },
    midBand:  { type: 'peaking',   frequency: 1800, gain:   3, Q: 2.0, enabled: true },
    highBand: { type: 'lowpass',   frequency: 3400, gain:   0, Q: 1.5, enabled: true },
    airBand:  { type: 'peaking',   frequency:12000, gain: -12, Q: 0.7, enabled: false },
  },

  bassBoost: {
    subBand:  { type: 'peaking',   frequency:   60, gain:   8, Q: 1.0, enabled: true },
    lowBand:  { type: 'lowshelf',  frequency:  200, gain:   4, Q: 1.0, enabled: true },
    midBand:  { type: 'peaking',   frequency: 1000, gain:   0, Q: 1.0, enabled: true },
    highBand: { type: 'highshelf', frequency: 5000, gain:   0, Q: 1.0, enabled: true },
    airBand:  { type: 'peaking',   frequency:12000, gain:   0, Q: 0.7, enabled: true },
  },
};

// ─── EQ ──────────────────────────────────────────────────────────────────────

export class EQ extends FXNodeBase {
  private bands: Record<EQBand, BiquadFilterNode>;
  private configs: EQConfig;

  private readonly listeners: {
    [K in keyof EQEventMap]?: Set<Listener<K>>;
  } = {};

  // ─── Constructor ────────────────────────────────────────────────────────────

  constructor(id: string, initialConfig: Partial<EQConfig> = {}) {
    super(id);

    this.configs = {
      subBand:  { ...DEFAULTS.subBand,  ...initialConfig.subBand  },
      lowBand:  { ...DEFAULTS.lowBand,  ...initialConfig.lowBand  },
      midBand:  { ...DEFAULTS.midBand,  ...initialConfig.midBand  },
      highBand: { ...DEFAULTS.highBand, ...initialConfig.highBand },
      airBand:  { ...DEFAULTS.airBand,  ...initialConfig.airBand  },
    };

    const ctx = this.context;

    this.bands = {
      subBand:  ctx.createBiquadFilter(),
      lowBand:  ctx.createBiquadFilter(),
      midBand:  ctx.createBiquadFilter(),
      highBand: ctx.createBiquadFilter(),
      airBand:  ctx.createBiquadFilter(),
    };

    // Apply initial config to each filter node
    (Object.keys(this.configs) as EQBand[]).forEach((band) => {
      this.applyConfigToNode(band, this.configs[band], /* ramp */ false);
    });
  }

  // ─── Signal chain ────────────────────────────────────────────────────────────

  /**
   * input → subBand → lowBand → midBand → highBand → airBand → wetGain → output
   *
   * Disabled bands are bypassed with a passthrough connection so the chain
   * stays intact without re-wiring on every toggle.
   */
  protected connectEffect(): void {
    const ordered: BiquadFilterNode[] = [
      this.bands.subBand,
      this.bands.lowBand,
      this.bands.midBand,
      this.bands.highBand,
      this.bands.airBand,
    ];

    let prev: AudioNode = this.input;
    for (const node of ordered) {
      prev.connect(node);
      prev = node;
    }
    prev.connect(this.wetGain);
    this.wetGain.connect(this.output);
  }

  // ─── Band control (typed) ─────────────────────────────────────────────────────

  /**
   * Update any subset of a band's parameters. Changes are applied with a
   * short ramp to prevent clicks.
   */
  setBand(band: EQBand, changes: Partial<EQBandConfig>): void {
    const next = { ...this.configs[band], ...changes };
    this.configs[band] = next;
    this.applyConfigToNode(band, next, /* ramp */ true);
    this.emit('bandChanged', { band, config: next });
  }

  /** Convenience setters (backwards-compatible with original API) */
  setLowGain(db: number)        { this.setBand('lowBand',  { gain:      db   }); }
  setLowFrequency(freq: number) { this.setBand('lowBand',  { frequency: freq }); }

  setMidGain(db: number)        { this.setBand('midBand',  { gain:      db   }); }
  setMidFrequency(freq: number) { this.setBand('midBand',  { frequency: freq }); }
  setMidQ(q: number)            { this.setBand('midBand',  { Q:         q    }); }

  setHighGain(db: number)       { this.setBand('highBand', { gain:      db   }); }
  setHighFrequency(freq: number){ this.setBand('highBand', { frequency: freq }); }

  // Sub band
  setSubGain(db: number)        { this.setBand('subBand',  { gain:      db   }); }
  setSubFrequency(freq: number) { this.setBand('subBand',  { frequency: freq }); }
  setSubType(type: EQBandType)  { this.setBand('subBand',  { type            }); }

  // Air band
  setAirGain(db: number)        { this.setBand('airBand',  { gain:      db   }); }
  setAirFrequency(freq: number) { this.setBand('airBand',  { frequency: freq }); }

  /**
   * Enable or disable a single band. A disabled band has its gain zeroed
   * (for shelf/peaking) or Q set to neutral so it passes signal unmodified.
   */
  setBandEnabled(band: EQBand, enabled: boolean): void {
    this.setBand(band, { enabled });
  }

  // ─── Presets ─────────────────────────────────────────────────────────────────

  loadPreset(name: string): void {
    const preset = EQ_PRESETS[name];
    if (!preset) throw new Error(`[EQ] Unknown preset "${name}".`);

    (Object.keys(preset) as EQBand[]).forEach((band) => {
      this.configs[band] = { ...preset[band] };
      this.applyConfigToNode(band, this.configs[band], /* ramp */ true);
    });

    this.emit('presetLoaded', { name, config: { ...this.configs } });
  }

  /** Save the current state as a named preset (stored in-memory) */
  savePreset(name: string): void {
    EQ_PRESETS[name] = this.toJSON().bands;
  }

  // ─── Frequency response ───────────────────────────────────────────────────────

  /**
   * Compute the combined magnitude response of all enabled bands across
   * `frequencies`. Useful for drawing an EQ curve.
   *
   * @param frequencies  Array of Hz values to evaluate
   * @returns            dB values at each frequency
   */
  getFrequencyResponse(frequencies: Float32Array): Float32Array {
    const magOut   = (new Float32Array(frequencies.length) as unknown as Float32Array).fill(1);
    const phaseOut = new Float32Array(frequencies.length) as unknown as Float32Array;
    const tempMag  = new Float32Array(frequencies.length) as unknown as Float32Array;
    const tempPhase= new Float32Array(frequencies.length) as unknown as Float32Array;

    for (const [band, node] of Object.entries(this.bands) as [EQBand, BiquadFilterNode][]) {
      if (!this.configs[band].enabled) continue;
      node.getFrequencyResponse(frequencies, tempMag, tempPhase);
      for (let i = 0; i < magOut.length; i++) {
        magOut[i] *= tempMag[i]; // multiply magnitudes (linear, not dB)
        phaseOut[i] += tempPhase[i];
      }
    }

    // Convert to dB
    const dbOut = new Float32Array(frequencies.length) as unknown as Float32Array;
    for (let i = 0; i < dbOut.length; i++) {
      dbOut[i] = 20 * Math.log10(Math.max(magOut[i], 1e-10));
    }
    return dbOut;
  }

  // ─── Serialisation ────────────────────────────────────────────────────────────

  getBandConfig(band: EQBand): Readonly<EQBandConfig> {
    return { ...this.configs[band] };
  }

  toJSON() {
    return {
      id:      this.id,
      bypassed: this.bypassed,
      bands:   { ...this.configs } as EQConfig,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private applyConfigToNode(
    band: EQBand,
    config: EQBandConfig,
    ramp: boolean,
  ): void {
    const node = this.bands[band];
    const t    = this.context.currentTime;
    const TAU  = 0.015; // 15 ms smoothing constant

    // Update filter type (can't be ramped)
    if (node.type !== config.type) node.type = config.type;

    if (config.enabled) {
      ramp
        ? smoothParam(node.frequency, config.frequency, t)
        : (node.frequency.value = config.frequency);

      // gain only affects shelf and peaking filters
      const hasGain = config.type === 'lowshelf' || config.type === 'highshelf' || config.type === 'peaking';
      if (hasGain) {
        ramp
          ? smoothParam(node.gain, config.gain, t)
          : (node.gain.value = config.gain);
      }

      ramp
        ? smoothParam(node.Q, config.Q, t)
        : (node.Q.value = config.Q);
    } else {
      // Neutral values that pass signal unmodified regardless of filter type
      ramp
        ? node.gain.setTargetAtTime(0, t, TAU)
        : (node.gain.value = 0);
    }
  }

  // ─── Event emitter ────────────────────────────────────────────────────────────

  on<K extends keyof EQEventMap>(event: K, listener: Listener<K>): this {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = new Set();
    }
    (this.listeners[event] as Set<Listener<K>>).add(listener);
    return this;
  }

  off<K extends keyof EQEventMap>(event: K, listener: Listener<K>): this {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(listener);
    return this;
  }

  once<K extends keyof EQEventMap>(event: K, listener: Listener<K>): this {
    const wrapper: Listener<K> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  private emit<K extends keyof EQEventMap>(event: K, payload: EQEventMap[K]): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.forEach((fn) => fn(payload));
  }
}