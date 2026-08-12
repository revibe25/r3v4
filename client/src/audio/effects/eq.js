// @ts-nocheck
import * as Tone from 'tone';
export class EQEffect {
    constructor() {
        this.lowShelf = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
        this.params = { enabled: true, type: 'eq', low: 0, mid: 0, high: 0, wet: 1, dry: 0 };
    }
    setParams(params) {
        this.params = { ...this.params, ...params };
        this.updateEQ();
    }
    updateEQ() {
        if (!this.params.enabled)
            return;
        this.lowShelf.low.value = this.params.low ?? 0;
        this.lowShelf.mid.value = this.params.mid ?? 0;
        this.lowShelf.high.value = this.params.high ?? 0;
    }
    connect(source) {
        source.connect(this.lowShelf);
        return this;
    }
    disconnect() { this.lowShelf.disconnect(); }
    getParams() { return { ...this.params }; }
    getNode() { return this.lowShelf; }
    dispose() { this.lowShelf.dispose(); }
    /** Returns the terminal output node for explicit chain wiring. */
    getOutput() {
        return this.lowShelf;
    }
    /**
     * Connect this effect into an explicit audio chain.
     * Use instead of letting the effect route to ctx.destination directly.
     */
    connectTo(destination) {
        this.lowShelf.connect(destination);
        return this;
    }
}
export const EQ_PRESETS = {
    flat: { low: 0, mid: 0, high: 0 },
    bassBoost: { low: 6, mid: 0, high: 0 },
    presence: { low: 0, mid: 3, high: 2 },
    airiness: { low: -2, mid: 0, high: 5 },
    warmth: { low: 4, mid: -1, high: -2 },
    scoop: { low: 2, mid: -4, high: 2 },
};
export const EQ_STYLES = {
    flat: 'No equalization applied',
    bassBoost: 'Enhanced low frequencies',
    presence: 'Enhanced midrange clarity',
    airiness: 'Bright and airy top end',
    warmth: 'Warm and full low end',
    scoop: 'Scooped midrange for clarity',
};
