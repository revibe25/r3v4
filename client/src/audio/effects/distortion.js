import * as Tone from 'tone';
export class DistortionEffect {
    constructor() {
        this.distortion = new Tone.Distortion({ distortion: 0.4, oversample: '2x', wet: 1 });
        this.dryGain = new Tone.Gain({ gain: 0.5 });
        this.wetGain = new Tone.Gain({ gain: 0.5 });
        this.output = new Tone.Gain({ gain: 1 });
        this.distortion.connect(this.wetGain);
        this.dryGain.connect(this.output);
        this.wetGain.connect(this.output);
        // DO NOT call toDestination() here.
        // DistortionEffect is an insert effect — callers connect it into their
        // signal chain via connect(). Calling toDestination() here caused the
        // distorted signal to route DIRECTLY to speakers at full gain, bypassing
        // the master bus, MixerChannel volume, and any downstream limiting.
        // This was the primary source of uncontrolled loud distortion in the app.
        // Callers must explicitly connect: source.connect(dist); dist.output → dest
        this.params = {
            enabled: true, type: 'distortion',
            drive: 0.4, wet: 0.5, dry: 0.5,
        };
    }
    setParams(params) {
        this.params = { ...this.params, ...params };
        this.updateDistortion();
    }
    updateDistortion() {
        if (!this.params.enabled) {
            this.wetGain.gain.rampTo(0, 0.05);
            this.dryGain.gain.rampTo(1, 0.05);
            return;
        }
        this.distortion.distortion = Math.max(0, Math.min(1, this.params.drive));
        this.wetGain.gain.rampTo(this.params.wet, 0.1);
        this.dryGain.gain.rampTo(this.params.dry, 0.1);
    }
    connect(source) {
        source.connect(this.dryGain);
        source.connect(this.distortion);
        return this;
    }
    disconnect() {
        this.dryGain.disconnect();
        this.distortion.disconnect();
        this.output.disconnect();
    }
    getParams() { return { ...this.params }; }
    getNode() { return this.distortion; }
    dispose() {
        this.distortion.dispose();
        this.dryGain.dispose();
        this.wetGain.dispose();
        this.output.dispose();
    }
}
export const DISTORTION_PRESETS = {
    subtle: { drive: 0.1, wet: 0.3, dry: 0.7 },
    warm: { drive: 0.3, wet: 0.5, dry: 0.5 },
    crunch: { drive: 0.5, wet: 0.6, dry: 0.4 },
    heavy: { drive: 0.7, wet: 0.75, dry: 0.25 },
    fuzz: { drive: 0.9, wet: 0.85, dry: 0.15 },
    destroy: { drive: 1.0, wet: 1.0, dry: 0.0 },
};
export const DISTORTION_TYPES = {
    subtle: 'Gentle harmonic saturation',
    warm: 'Warm tape-style overdrive',
    crunch: 'Crunchy guitar-style distortion',
    heavy: 'Heavy amp distortion',
    fuzz: 'Vintage fuzz pedal',
    destroy: 'Maximum destruction',
};
