export class Smoother {
    constructor(sampleRate, timeMs, defaultValue) {
        this.timeMs = timeMs;
        this.smoothed = defaultValue;
        this.g = 1 - Math.exp(-1 / (sampleRate * (this.timeMs / 1000)));
    }
    update(target) {
        this.smoothed += this.g * (target - this.smoothed);
        return this.smoothed;
    }
    get value() { return this.smoothed; }
    reset(val) { this.smoothed = val; }
}
