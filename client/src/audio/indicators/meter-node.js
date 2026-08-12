// client/src/audio/indicators/meter-node.ts
import { getAudioContext } from "../core/audio-context";
export class MeterNode {
    constructor(id) {
        this.id = id;
        const context = getAudioContext();
        this.analyser = context.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.buffer = new Float32Array(this.analyser.fftSize);
    }
    connect(source) {
        source.connect(this.analyser);
    }
    disconnect() {
        this.analyser.disconnect();
    }
    getMeterData() {
        this.analyser.getFloatTimeDomainData(this.buffer);
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < this.buffer.length; i++) {
            const v = this.buffer[i];
            sum += v * v;
            peak = Math.max(peak, Math.abs(v));
        }
        const rms = Math.sqrt(sum / this.buffer.length);
        return { rms, peak };
    }
}
