// client/src/audio/fx/fx-node-base.ts
import { getAudioContext } from "../core/audio-context";
export class FXNodeBase {
    get isBypassed() { return this.bypassed; }
    constructor(id) {
        this.bypassed = false;
        this.id = id;
        this.context = getAudioContext();
        this.input = this.context.createGain();
        this.output = this.context.createGain();
        this.wetGain = this.context.createGain();
        this.dryGain = this.context.createGain();
        // defaults
        this.wetGain.gain.setTargetAtTime(1, this.context.currentTime, 0.015);
        this.dryGain.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
        // dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        // wet path (implemented by subclasses)
        this.connectEffect();
    }
    connect(destination) {
        this.output.connect(destination);
    }
    disconnect() {
        this.output.disconnect();
    }
    setBypass(bypass) {
        if (this.bypassed === bypass)
            return;
        const now = this.context.currentTime;
        const fadeTime = 0.01;
        this.wetGain.gain.cancelScheduledValues(now);
        this.dryGain.gain.cancelScheduledValues(now);
        if (bypass) {
            this.wetGain.gain.setTargetAtTime(0, now, fadeTime);
            this.dryGain.gain.setTargetAtTime(1, now, fadeTime);
        }
        else {
            this.wetGain.gain.setTargetAtTime(1, now, fadeTime);
            this.dryGain.gain.setTargetAtTime(0, now, fadeTime);
        }
        this.bypassed = bypass;
    }
    dispose() { }
    bypass(_enabled) { }
    setWetDry(_wet, _dry) { }
    setParam(_name, _value) { }
    getParam(_name) { return 0; }
    getParams() { return {}; }
}
