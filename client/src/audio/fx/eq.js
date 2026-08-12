// @ts-nocheck
// FILE: client/src/audio/fx/eq.ts
import { FXNodeBase } from './fx-nodebase';
import { smoothParam } from '../../utils/audio-utils';
// ─── Default config ───────────────────────────────────────────────────────────
const DEFAULTS = {
    subBand: { type: 'highpass', frequency: 80, gain: 0, Q: 0.7, enabled: true },
    lowBand: { type: 'lowshelf', frequency: 200, gain: 0, Q: 1.0, enabled: true },
    midBand: { type: 'peaking', frequency: 1000, gain: 0, Q: 1.0, enabled: true },
    highBand: { type: 'highshelf', frequency: 5000, gain: 0, Q: 1.0, enabled: true },
    airBand: { type: 'peaking', frequency: 12000, gain: 0, Q: 0.7, enabled: true },
};
// ─── Presets ──────────────────────────────────────────────────────────────────
export const EQ_PRESETS = {
    flat: DEFAULTS,
    warmVocals: {
        subBand: { type: 'highpass', frequency: 100, gain: 0, Q: 0.7, enabled: true },
        lowBand: { type: 'lowshelf', frequency: 250, gain: 3, Q: 1.0, enabled: true },
        midBand: { type: 'peaking', frequency: 2500, gain: -2, Q: 1.2, enabled: true },
        highBand: { type: 'highshelf', frequency: 6000, gain: 2, Q: 1.0, enabled: true },
        airBand: { type: 'peaking', frequency: 12000, gain: 1, Q: 0.7, enabled: true },
    },
    kickDrum: {
        subBand: { type: 'highpass', frequency: 30, gain: 0, Q: 0.7, enabled: true },
        lowBand: { type: 'peaking', frequency: 80, gain: 6, Q: 1.5, enabled: true },
        midBand: { type: 'peaking', frequency: 400, gain: -4, Q: 1.0, enabled: true },
        highBand: { type: 'peaking', frequency: 4000, gain: 3, Q: 1.0, enabled: true },
        airBand: { type: 'highshelf', frequency: 8000, gain: -2, Q: 1.0, enabled: true },
    },
    telephoneEffect: {
        subBand: { type: 'highpass', frequency: 300, gain: 0, Q: 1.5, enabled: true },
        lowBand: { type: 'peaking', frequency: 700, gain: 6, Q: 2.0, enabled: true },
        midBand: { type: 'peaking', frequency: 1800, gain: 3, Q: 2.0, enabled: true },
        highBand: { type: 'lowpass', frequency: 3400, gain: 0, Q: 1.5, enabled: true },
        airBand: { type: 'peaking', frequency: 12000, gain: -12, Q: 0.7, enabled: false },
    },
    bassBoost: {
        subBand: { type: 'peaking', frequency: 60, gain: 8, Q: 1.0, enabled: true },
        lowBand: { type: 'lowshelf', frequency: 200, gain: 4, Q: 1.0, enabled: true },
        midBand: { type: 'peaking', frequency: 1000, gain: 0, Q: 1.0, enabled: true },
        highBand: { type: 'highshelf', frequency: 5000, gain: 0, Q: 1.0, enabled: true },
        airBand: { type: 'peaking', frequency: 12000, gain: 0, Q: 0.7, enabled: true },
    },
};
// ─── EQ ──────────────────────────────────────────────────────────────────────
export class EQ extends FXNodeBase {
    // ─── Constructor ────────────────────────────────────────────────────────────
    constructor(id, initialConfig = {}) {
        super(id);
        this.listeners = {};
        this.configs = {
            subBand: { ...DEFAULTS.subBand, ...initialConfig.subBand },
            lowBand: { ...DEFAULTS.lowBand, ...initialConfig.lowBand },
            midBand: { ...DEFAULTS.midBand, ...initialConfig.midBand },
            highBand: { ...DEFAULTS.highBand, ...initialConfig.highBand },
            airBand: { ...DEFAULTS.airBand, ...initialConfig.airBand },
        };
        const ctx = this.context;
        this.bands = {
            subBand: ctx.createBiquadFilter(),
            lowBand: ctx.createBiquadFilter(),
            midBand: ctx.createBiquadFilter(),
            highBand: ctx.createBiquadFilter(),
            airBand: ctx.createBiquadFilter(),
        };
        // Apply initial config to each filter node
        Object.keys(this.configs).forEach((band) => {
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
    connectEffect() {
        const ordered = [
            this.bands.subBand,
            this.bands.lowBand,
            this.bands.midBand,
            this.bands.highBand,
            this.bands.airBand,
        ];
        let prev = this.input;
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
    setBand(band, changes) {
        const next = { ...this.configs[band], ...changes };
        this.configs[band] = next;
        this.applyConfigToNode(band, next, /* ramp */ true);
        this.emit('bandChanged', { band, config: next });
    }
    /** Convenience setters (backwards-compatible with original API) */
    setLowGain(db) { this.setBand('lowBand', { gain: db }); }
    setLowFrequency(freq) { this.setBand('lowBand', { frequency: freq }); }
    setMidGain(db) { this.setBand('midBand', { gain: db }); }
    setMidFrequency(freq) { this.setBand('midBand', { frequency: freq }); }
    setMidQ(q) { this.setBand('midBand', { Q: q }); }
    setHighGain(db) { this.setBand('highBand', { gain: db }); }
    setHighFrequency(freq) { this.setBand('highBand', { frequency: freq }); }
    // Sub band
    setSubGain(db) { this.setBand('subBand', { gain: db }); }
    setSubFrequency(freq) { this.setBand('subBand', { frequency: freq }); }
    setSubType(type) { this.setBand('subBand', { type }); }
    // Air band
    setAirGain(db) { this.setBand('airBand', { gain: db }); }
    setAirFrequency(freq) { this.setBand('airBand', { frequency: freq }); }
    /**
     * Enable or disable a single band. A disabled band has its gain zeroed
     * (for shelf/peaking) or Q set to neutral so it passes signal unmodified.
     */
    setBandEnabled(band, enabled) {
        this.setBand(band, { enabled });
    }
    // ─── Presets ─────────────────────────────────────────────────────────────────
    loadPreset(name) {
        const preset = EQ_PRESETS[name];
        if (!preset)
            throw new Error(`[EQ] Unknown preset "${name}".`);
        Object.keys(preset).forEach((band) => {
            this.configs[band] = { ...preset[band] };
            this.applyConfigToNode(band, this.configs[band], /* ramp */ true);
        });
        this.emit('presetLoaded', { name, config: { ...this.configs } });
    }
    /** Save the current state as a named preset (stored in-memory) */
    savePreset(name) {
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
    getFrequencyResponse(frequencies) {
        const magOut = new Float32Array(frequencies.length).fill(1);
        const phaseOut = new Float32Array(frequencies.length);
        const tempMag = new Float32Array(frequencies.length);
        const tempPhase = new Float32Array(frequencies.length);
        for (const [band, node] of Object.entries(this.bands)) {
            if (!this.configs[band].enabled)
                continue;
            node.getFrequencyResponse(frequencies, tempMag, tempPhase);
            for (let i = 0; i < magOut.length; i++) {
                magOut[i] *= tempMag[i]; // multiply magnitudes (linear, not dB)
                phaseOut[i] += tempPhase[i];
            }
        }
        // Convert to dB
        const dbOut = new Float32Array(frequencies.length);
        for (let i = 0; i < dbOut.length; i++) {
            dbOut[i] = 20 * Math.log10(Math.max(magOut[i], 1e-10));
        }
        return dbOut;
    }
    // ─── Serialisation ────────────────────────────────────────────────────────────
    getBandConfig(band) {
        return { ...this.configs[band] };
    }
    toJSON() {
        return {
            id: this.id,
            bypassed: this.bypassed,
            bands: { ...this.configs },
        };
    }
    // ─── Private helpers ──────────────────────────────────────────────────────────
    applyConfigToNode(band, config, ramp) {
        const node = this.bands[band];
        const t = this.context.currentTime;
        const TAU = 0.015; // 15 ms smoothing constant
        // Update filter type (can't be ramped)
        if (node.type !== config.type)
            node.type = config.type;
        if (config.enabled) {
            ramp
                ? smoothParam(node.frequency, config.frequency, t)
                : (node.frequency.value = config.frequency);
            // gain only affects shelf and peaking filters
            const hasGain = config.type === 'lowshelf' || config.type === 'highshelf' || config.type === 'peaking';
            if (hasGain) {
                ramp
                    ? smoothParam(node.gain, config.gain, t)
                    : (node.gain.setTargetAtTime(config.gain), this.context.currentTime, 0.015);
            }
            ramp
                ? smoothParam(node.Q, config.Q, t)
                : (node.Q.value = config.Q);
        }
        else {
            // Neutral values that pass signal unmodified regardless of filter type
            ramp
                ? node.gain.setTargetAtTime(0, t, TAU)
                : (node.gain.setTargetAtTime(0), this.context.currentTime, 0.015);
        }
    }
    // ─── Event emitter ────────────────────────────────────────────────────────────
    on(event, listener) {
        if (!this.listeners[event]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.listeners[event] = new Set();
        }
        this.listeners[event].add(listener);
        return this;
    }
    off(event, listener) {
        this.listeners[event]?.delete(listener);
        return this;
    }
    once(event, listener) {
        const wrapper = (payload) => {
            listener(payload);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }
    emit(event, payload) {
        this.listeners[event]?.forEach((fn) => fn(payload));
    }
}
