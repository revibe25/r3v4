import * as Tone from 'tone';
export class FilterEffect {
    constructor() {
        this.filter = new Tone.Filter({ frequency: 20000, type: 'lowpass', rolloff: -12 });
        this.params = {
            enabled: true, type: 'filter',
            frequency: 20000, filterType: 'lowpass',
            resonance: 1, rolloff: -12,
            wet: 1, dry: 0,
        };
    }
    setParams(params) {
        this.params = { ...this.params, ...params };
        this.updateFilter();
    }
    updateFilter() {
        if (!this.params.enabled)
            return;
        this.filter.frequency.rampTo(Math.max(20, Math.min(20000, this.params.frequency)), 0.05);
        this.filter.Q.rampTo(Math.max(0.1, this.params.resonance), 0.05);
        this.filter.type = this.params.filterType;
    }
    connect(source) {
        source.connect(this.filter);
        return this;
    }
    disconnect() { this.filter.disconnect(); }
    getParams() { return { ...this.params }; }
    getNode() { return this.filter; }
    dispose() { this.filter.dispose(); }
    /** Returns the terminal output node for explicit chain wiring. */
    getOutput() {
        return this.filter;
    }
    /**
     * Connect this effect into an explicit audio chain.
     * Use instead of letting the effect route to ctx.destination directly.
     */
    connectTo(destination) {
        this.filter.connect(destination);
        return this;
    }
}
export const FILTER_PRESETS = {
    open: { frequency: 20000, filterType: 'lowpass', resonance: 1 },
    warm: { frequency: 8000, filterType: 'lowpass', resonance: 0.7 },
    dark: { frequency: 3000, filterType: 'lowpass', resonance: 1 },
    telephone: { frequency: 3000, filterType: 'bandpass', resonance: 8 },
    highpass: { frequency: 200, filterType: 'highpass', resonance: 1 },
    notch: { frequency: 1000, filterType: 'notch', resonance: 10 },
};
export const FILTER_FREQUENCIES = {
    subBass: 60, bass: 200, lowMid: 500,
    mid: 1000, highMid: 4000, presence: 8000, air: 16000,
};
