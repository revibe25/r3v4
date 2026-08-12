import { getAudioContext } from "@/audio/core/audio-context";
export class AudioEngine {
    constructor(config) {
        this.lastBeat = 0;
        this.bpm = 120;
        this.phase = 0;
        this.beatCallbacks = [];
        this.updateCallbacks = [];
        this.state = {
            bpm: 120,
            rms: 0,
            spectrum: new Float32Array(1024),
            beatPhase: 0,
            bassRMS: 0,
            midRMS: 0,
            trebleRMS: 0,
            spectralCentroid: 0,
            spectralFlux: 0,
            onsetDetected: false,
        };
        this.loop = () => {
            this.analyser.getFloatFrequencyData(this.data);
            const N = this.data.length;
            // Convert dB → linear magnitude
            const mag = new Float32Array(N);
            for (let i = 0; i < N; i++)
                mag[i] = Math.pow(10, this.data[i] / 20);
            // RMS calculations
            let sumSquares = 0, bassSum = 0, midSum = 0, trebleSum = 0, centroidSum = 0, totalMag = 0;
            for (let i = 0; i < N; i++) {
                const m = mag[i];
                sumSquares += m * m;
                if (i < N / 4)
                    bassSum += m * m;
                else if (i < N / 2)
                    midSum += m * m;
                else
                    trebleSum += m * m;
                centroidSum += i * m;
                totalMag += m;
            }
            const rms = Math.sqrt(sumSquares / N);
            const bassRMS = Math.sqrt(bassSum / (N / 4));
            const midRMS = Math.sqrt(midSum / (N / 4));
            const trebleRMS = Math.sqrt(trebleSum / (N / 2));
            const spectralCentroid = centroidSum / totalMag / N;
            // Spectral flux (difference with previous frame)
            let flux = 0;
            for (let i = 0; i < N; i++) {
                const diff = mag[i] - this.previousData[i];
                flux += diff > 0 ? diff : 0;
                this.previousData[i] = mag[i];
            }
            flux /= N;
            // Onset detection
            const onsetDetected = flux > this.config.onsetThreshold;
            // Beat detection with smoothing
            const now = this.ctx.currentTime;
            if (onsetDetected && now - this.lastBeat > 0.2 && rms > this.config.beatThreshold) {
                const delta = now - this.lastBeat;
                const instantBPM = 60 / delta;
                this.bpm = this.config.bpmSmoothing * this.bpm + (1 - this.config.bpmSmoothing) * instantBPM;
                this.lastBeat = now;
                this.beatCallbacks.forEach((cb) => cb(this.state));
            }
            this.phase = ((now - this.lastBeat) * this.bpm) / 60;
            this.state = {
                bpm: this.bpm,
                rms,
                spectrum: this.data,
                beatPhase: this.phase % 1,
                bassRMS,
                midRMS,
                trebleRMS,
                spectralCentroid,
                spectralFlux: flux,
                onsetDetected,
            };
            this.updateCallbacks.forEach((cb) => cb(this.state));
            requestAnimationFrame(this.loop);
        };
        this.config = {
            fftSize: 2048,
            smoothingTimeConstant: 0.8,
            beatThreshold: 0.25,
            onsetThreshold: 0.1,
            bpmSmoothing: 0.9,
            ...config,
        };
    }
    async start() {
        this.ctx = getAudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const src = this.ctx.createMediaStreamSource(stream);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = this.config.fftSize;
        this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
        this.data = new Float32Array(this.analyser.frequencyBinCount);
        this.previousData = new Float32Array(this.analyser.frequencyBinCount);
        src.connect(this.analyser);
        this.loop();
    }
    onBeat(callback) {
        this.beatCallbacks.push(callback);
    }
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }
}
export const beatDetector = new AudioEngine();
