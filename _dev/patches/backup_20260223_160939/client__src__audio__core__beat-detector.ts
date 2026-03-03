// client/src/engine/audio-engine.ts

export interface AudioState {
  bpm: number;
  rms: number;
  spectrum: Float32Array;
  beatPhase: number; // 0 → 1
  bassRMS: number;
  midRMS: number;
  trebleRMS: number;
  spectralCentroid: number;
  spectralFlux: number;
  onsetDetected: boolean;
}

interface AudioEngineConfig {
  fftSize?: number;
  smoothingTimeConstant?: number;
  beatThreshold?: number;
  onsetThreshold?: number;
  bpmSmoothing?: number; // 0 → 1
}

type BeatCallback = (state: AudioState) => void;
type UpdateCallback = (state: AudioState) => void;

export class AudioEngine {
  private ctx!: AudioContext;
  private analyser!: AnalyserNode;
  private data!: Float32Array;
  private previousData!: Float32Array;
  private lastBeat = 0;
  private bpm = 120;
  private phase = 0;
  private beatCallbacks: BeatCallback[] = [];
  private updateCallbacks: UpdateCallback[] = [];
  private config: AudioEngineConfig;

  state: AudioState = {
    bpm: 120,
    rms: 0,
    spectrum: new Float32Array(1024) as unknown as Float32Array,
    beatPhase: 0,
    bassRMS: 0,
    midRMS: 0,
    trebleRMS: 0,
    spectralCentroid: 0,
    spectralFlux: 0,
    onsetDetected: false,
  };

  constructor(config?: AudioEngineConfig) {
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
    this.ctx = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = this.ctx.createMediaStreamSource(stream);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.config.fftSize!;
    this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant!;
    this.data = new Float32Array(this.analyser.frequencyBinCount) as unknown as Float32Array;
    this.previousData = new Float32Array(this.analyser.frequencyBinCount) as unknown as Float32Array;

    src.connect(this.analyser);

    this.loop();
  }

  onBeat(callback: BeatCallback) {
    this.beatCallbacks.push(callback);
  }

  onUpdate(callback: UpdateCallback) {
    this.updateCallbacks.push(callback);
  }

  private loop = () => {
    this.analyser.getFloatFrequencyData(this.data);

    const N = this.data.length;

    // Convert dB → linear magnitude
    const mag = new Float32Array(N) as unknown as Float32Array;
    for (let i = 0; i < N; i++) mag[i] = Math.pow(10, this.data[i] / 20);

    // RMS calculations
    let sumSquares = 0,
      bassSum = 0,
      midSum = 0,
      trebleSum = 0,
      centroidSum = 0,
      totalMag = 0;

    for (let i = 0; i < N; i++) {
      const m = mag[i];
      sumSquares += m * m;

      if (i < N / 4) bassSum += m * m;
      else if (i < N / 2) midSum += m * m;
      else trebleSum += m * m;

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
    const onsetDetected = flux > this.config.onsetThreshold!;

    // Beat detection with smoothing
    const now = this.ctx.currentTime;
    if (onsetDetected && now - this.lastBeat > 0.2 && rms > this.config.beatThreshold!) {
      const delta = now - this.lastBeat;
      const instantBPM = 60 / delta;
      this.bpm = this.config.bpmSmoothing! * this.bpm + (1 - this.config.bpmSmoothing!) * instantBPM;
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
}

export const beatDetector = new AudioEngine();
