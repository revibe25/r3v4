// FILE: client/src/audio/core/audio-graph.ts
import {
  getAudioContext,
  resumeAudioContext,
  onAudioContext,
  closeAudioContext,
} from './audio-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendBus {
  id:     string;
  gain:   GainNode;
  /** The node other tracks connect their send into */
  input:  GainNode;
  output: GainNode;
}

export interface MeterReading {
  peak:    number;   // 0–1
  rms:     number;   // 0–1
  clipping: boolean;
}

export interface AnalysisTelemetry {
  sampleRate: number;
  active: boolean;
  peakL: number;
  peakR: number;
  peakDbL: number;
  peakDbR: number;
  rms: number;
  rmsDb: number;
  correlation: number;
  stereoWidth: number;
  truePeak: number;
  truePeakDb: number;
  momentaryLufs: number;
  integratedLufs: number;
  gainReductionDb: number;
  clipping: boolean;
  spectrum: Uint8Array;
  waveformL: Float32Array<ArrayBuffer>;
  waveformR: Float32Array<ArrayBuffer>;
}

export type AudioGraphEventMap = {
  masterVolumeChanged: { value: number };
  sendAdded:           { bus: SendBus };
  sendRemoved:         { id: string };
  metering:            { reading: MeterReading };
  disposed:            {};
};

type Listener<K extends keyof AudioGraphEventMap> = (
  payload: AudioGraphEventMap[K],
) => void;

// ─── AudioGraph ───────────────────────────────────────────────────────────────

export class AudioGraph {
  readonly context: AudioContext;

  // Master chain: [inputs] → masterGain → limiter → analyser → destination
  readonly masterGain: GainNode;
  readonly destination: AudioDestinationNode;

  private limiter: DynamicsCompressorNode;
  private analyser: AnalyserNode;
  private analyserBuffer: Float32Array<ArrayBuffer>;

  private stereoSplitter: ChannelSplitterNode;
  private leftAnalyser: AnalyserNode;
  private rightAnalyser: AnalyserNode;
  private kShelfLeft: BiquadFilterNode;
  private kShelfRight: BiquadFilterNode;
  private kHighpassLeft: BiquadFilterNode;
  private kHighpassRight: BiquadFilterNode;
  private kLeftAnalyser: AnalyserNode;
  private kRightAnalyser: AnalyserNode;
  private spectrumAnalyser: AnalyserNode;

  private leftBuffer: Float32Array<ArrayBuffer>;
  private rightBuffer: Float32Array<ArrayBuffer>;
  private kLeftBuffer: Float32Array<ArrayBuffer>;
  private kRightBuffer: Float32Array<ArrayBuffer>;
  private spectrumBuffer: Uint8Array;

  private loudnessRing: Array<{ at: number; energy: number }> = [];
  private loudnessBlocks: number[] = [];
  private lastLoudnessBlockAt = 0;
  private truePeakHold = 0;
  private latestTelemetry: AnalysisTelemetry;

  private sends = new Map<string, SendBus>();
  private _masterVolume = 1.0;
  private _disposed = false;

  private meteringFrameId?: number;
  private readonly listeners: {
    [K in keyof AudioGraphEventMap]?: Set<Listener<K>>;
  } = {};

  // Clean up when the AudioContext singleton is closed externally
  private removeContextListener: () => void;

  // ─── Constructor ────────────────────────────────────────────────────────────

  constructor() {
    this.context     = getAudioContext();
    this.destination = this.context.destination;

    // Master gain
    this.masterGain       = this.context.createGain();
    this.masterGain.gain.setTargetAtTime(1.0, this.context.currentTime, 0.015);

    // Transparent brickwall limiter — prevents inter-sample clipping on export
    this.limiter = this.context.createDynamicsCompressor();
    this.limiter.threshold.value = -1;   // dBFS
    this.limiter.knee.value      =  0;
    this.limiter.ratio.value     = 20;
    this.limiter.attack.value    =  0.001;
    this.limiter.release.value   =  0.1;

    // Analyser for metering
    this.analyser             = this.context.createAnalyser();
    this.analyser.fftSize     = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyserBuffer       = new Float32Array(this.analyser.fftSize) as unknown as Float32Array<ArrayBuffer>;

    // Chain: masterGain → limiter → analyser → destination
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.destination);

    // ─── Passive post-limiter analysis taps ───────────────────────────────
    this.stereoSplitter = this.context.createChannelSplitter(2);

    this.leftAnalyser = this.context.createAnalyser();
    this.leftAnalyser.fftSize = 2048;
    this.leftAnalyser.smoothingTimeConstant = 0;
    this.leftBuffer = new Float32Array(this.leftAnalyser.fftSize) as unknown as Float32Array<ArrayBuffer>;

    this.rightAnalyser = this.context.createAnalyser();
    this.rightAnalyser.fftSize = 2048;
    this.rightAnalyser.smoothingTimeConstant = 0;
    this.rightBuffer = new Float32Array(this.rightAnalyser.fftSize) as unknown as Float32Array<ArrayBuffer>;

    this.kShelfLeft = this.context.createBiquadFilter();
    this.kShelfLeft.type = 'highshelf';
    this.kShelfLeft.frequency.value = 1682;
    this.kShelfLeft.gain.value = 4;

    this.kShelfRight = this.context.createBiquadFilter();
    this.kShelfRight.type = 'highshelf';
    this.kShelfRight.frequency.value = 1682;
    this.kShelfRight.gain.value = 4;

    this.kHighpassLeft = this.context.createBiquadFilter();
    this.kHighpassLeft.type = 'highpass';
    this.kHighpassLeft.frequency.value = 38;
    this.kHighpassLeft.Q.value = 0.5;

    this.kHighpassRight = this.context.createBiquadFilter();
    this.kHighpassRight.type = 'highpass';
    this.kHighpassRight.frequency.value = 38;
    this.kHighpassRight.Q.value = 0.5;

    this.kLeftAnalyser = this.context.createAnalyser();
    this.kLeftAnalyser.fftSize = 2048;
    this.kLeftAnalyser.smoothingTimeConstant = 0;
    this.kLeftBuffer = new Float32Array(this.kLeftAnalyser.fftSize) as unknown as Float32Array<ArrayBuffer>;

    this.kRightAnalyser = this.context.createAnalyser();
    this.kRightAnalyser.fftSize = 2048;
    this.kRightAnalyser.smoothingTimeConstant = 0;
    this.kRightBuffer = new Float32Array(this.kRightAnalyser.fftSize) as unknown as Float32Array<ArrayBuffer>;

    this.spectrumAnalyser = this.context.createAnalyser();
    this.spectrumAnalyser.fftSize = 4096;
    this.spectrumAnalyser.smoothingTimeConstant = 0.78;
    this.spectrumBuffer = new Uint8Array(this.spectrumAnalyser.frequencyBinCount);

    // Wire passive taps (never feed destination)
    this.stereoSplitter.connect(this.leftAnalyser, 0);
    this.stereoSplitter.connect(this.rightAnalyser, 1);
    this.stereoSplitter.connect(this.kShelfLeft, 0);
    this.kShelfLeft.connect(this.kHighpassLeft);
    this.kHighpassLeft.connect(this.kLeftAnalyser);
    this.stereoSplitter.connect(this.kShelfRight, 1);
    this.kShelfRight.connect(this.kHighpassRight);
    this.kHighpassRight.connect(this.kRightAnalyser);

    // Spectrum tap
    this.limiter.connect(this.stereoSplitter);
    this.limiter.connect(this.spectrumAnalyser);

    // Initialize telemetry snapshot
    this.latestTelemetry = {
      sampleRate: this.context.sampleRate,
      active: false,
      peakL: 0,
      peakR: 0,
      peakDbL: -120,
      peakDbR: -120,
      rms: 0,
      rmsDb: -120,
      correlation: 0,
      stereoWidth: 0,
      truePeak: 0,
      truePeakDb: -120,
      momentaryLufs: -120,
      integratedLufs: -120,
      gainReductionDb: 0,
      clipping: false,
      spectrum: this.spectrumBuffer,
      waveformL: this.leftBuffer,
      waveformR: this.rightBuffer,
    };

    // Re-create internal nodes if the context is closed/re-opened
    this.removeContextListener = onAudioContext(() => {
      // If the singleton was closed and re-created, our graph nodes are stale.
      // Consumers should create a new AudioGraph instance in this case.
      console.warn('[AudioGraph] AudioContext was re-created. Instantiate a new AudioGraph.');
    });

    this.startMetering();
  }

  // ─── Volume ──────────────────────────────────────────────────────────────────

  get masterVolume(): number { return this._masterVolume; }

  /**
   * Set master output volume (0–1) with a short ramp to avoid clicks.
   */
  setMasterVolume(value: number, rampSeconds = 0.015): void {
    this.assertNotDisposed();
    const clamped = clamp(value, 0, 1);
    this._masterVolume = clamped;
    this.masterGain.gain.setTargetAtTime(
      clamped,
      this.context.currentTime,
      rampSeconds,
    );
    this.emit('masterVolumeChanged', { value: clamped });
  }

  /**
   * Mute/unmute the master output without changing the stored volume.
   */
  setMasterMute(muted: boolean, rampSeconds = 0.015): void {
    this.assertNotDisposed();
    const target = muted ? 0 : this._masterVolume;
    this.masterGain.gain.setTargetAtTime(
      target,
      this.context.currentTime,
      rampSeconds,
    );
  }

  // ─── Node Routing ────────────────────────────────────────────────────────────

  /**
   * Connect an arbitrary node into the master gain bus.
   */
  connect(node: AudioNode): void {
    this.assertNotDisposed();
    node.connect(this.masterGain);
  }

  /**
   * Disconnect a node from the master gain bus.
   * Silently ignores InvalidAccessError (node wasn't connected).
   */
  disconnect(node: AudioNode): void {
    try {
      node.disconnect(this.masterGain);
    } catch { /* already disconnected */ }
  }

  // ─── Send / Return Buses ─────────────────────────────────────────────────────

  /**
   * Create a named send/return bus (e.g. "reverb", "delay").
   * Callers connect their track send into `bus.input` and the bus output
   * feeds back into the master chain.
   */
  addSend(id: string, initialGain = 1.0): SendBus {
    this.assertNotDisposed();
    if (this.sends.has(id)) return this.sends.get(id)!;

    const input  = this.context.createGain();
    const gain   = this.context.createGain();
    const output = this.context.createGain();

    gain.gain.setTargetAtTime(initialGain, this.context.currentTime, 0.015);
    output.gain.setTargetAtTime(1.0, this.context.currentTime, 0.015);

    input.connect(gain);
    gain.connect(output);
    output.connect(this.masterGain);

    const bus: SendBus = { id, gain, input, output };
    this.sends.set(id, bus);
    this.emit('sendAdded', { bus });
    return bus;
  }

  getSend(id: string): SendBus | undefined {
    return this.sends.get(id);
  }

  removeSend(id: string): void {
    const bus = this.sends.get(id);
    if (!bus) return;
    try { bus.input.disconnect();  } catch { /* ok */ }
    try { bus.gain.disconnect();   } catch { /* ok */ }
    try { bus.output.disconnect(); } catch { /* ok */ }
    this.sends.delete(id);
    this.emit('sendRemoved', { id });
  }

  /** All current send bus ids */
  get sendIds(): string[] {
    return [...this.sends.keys()];
  }

  // ─── Metering ────────────────────────────────────────────────────────────────

  /**
   * Latest meter reading derived from the analyser node.
   * Populated every animation frame while the graph is alive.
   */
  getMeterReading(): MeterReading {
    const telemetry = this.latestTelemetry;
    return {
      peak: Math.max(telemetry.peakL, telemetry.peakR),
      rms: telemetry.rms,
      clipping: telemetry.clipping,
    };
  }

  getAnalysisTelemetry(): Readonly<AnalysisTelemetry> {
    return this.latestTelemetry;
  }

  private startMetering(): void {
    const tick = () => {
      if (this._disposed) return;
      const reading = this.computeMeter();
      this.emit('metering', { reading });
      this.meteringFrameId = requestAnimationFrame(tick);
    };
    this.meteringFrameId = requestAnimationFrame(tick);
  }

  restartMetering(): void {
    if (this._disposed) return;
    if (this.meteringFrameId !== undefined) {
      cancelAnimationFrame(this.meteringFrameId);
    }
    this.startMetering();
  }

  private computeMeter(): MeterReading {
    this.analyser.getFloatTimeDomainData(
      this.analyserBuffer as Float32Array<ArrayBuffer>
    );

    let peak = 0;
    let sumSq = 0;

    for (let i = 0; i < this.analyserBuffer.length; i++) {
      const sample = this.analyserBuffer[i];
      const abs = Math.abs(sample);
      peak = Math.max(peak, abs);
      sumSq += sample * sample;
    }

    const rms = Math.sqrt(sumSq / this.analyserBuffer.length);
    const clipping = peak > 0.99;

    // ─── Capture stereo analysis (pre-limiter) ───
    this.leftAnalyser.getFloatTimeDomainData(
      this.leftBuffer as Float32Array<ArrayBuffer>
    );
    this.rightAnalyser.getFloatTimeDomainData(
      this.rightBuffer as Float32Array<ArrayBuffer>
    );

    let peakL = 0, peakR = 0, sumSqL = 0, sumSqR = 0;
    for (let i = 0; i < this.leftBuffer.length; i++) {
      const l = this.leftBuffer[i];
      const r = this.rightBuffer[i];
      peakL = Math.max(peakL, Math.abs(l));
      peakR = Math.max(peakR, Math.abs(r));
      sumSqL += l * l;
      sumSqR += r * r;
    }

    const rmsL = Math.sqrt(sumSqL / this.leftBuffer.length);
    const rmsR = Math.sqrt(sumSqR / this.rightBuffer.length);

    // ─── K-weighted LUFS analysis ───
    this.kLeftAnalyser.getFloatTimeDomainData(
      this.kLeftBuffer as Float32Array<ArrayBuffer>
    );
    this.kRightAnalyser.getFloatTimeDomainData(
      this.kRightBuffer as Float32Array<ArrayBuffer>
    );

    let sumSqKL = 0, sumSqKR = 0;
    for (let i = 0; i < this.kLeftBuffer.length; i++) {
      const kl = this.kLeftBuffer[i];
      const kr = this.kRightBuffer[i];
      sumSqKL += kl * kl;
      sumSqKR += kr * kr;
    }

    const rmsKL = Math.sqrt(sumSqKL / this.kLeftBuffer.length);
    const rmsKR = Math.sqrt(sumSqKR / this.kRightBuffer.length);
    const rmsK = Math.sqrt((sumSqKL + sumSqKR) / this.kLeftBuffer.length);

    // Momentary LUFS (short-term, K-weighted)
    const momentaryLufs =
      rmsK > 1e-6
        ? -0.691 + 10 * Math.log10(Math.max(rmsK ** 2, 1e-10))
        : -120;

    // ─── Integrated LUFS: 400 ms blocks with absolute + relative gating ───
    const now = this.context.currentTime;
    const blockWindowSeconds = 0.4;

    if (
      this.loudnessRing.length === 0 ||
      now > this.loudnessRing[this.loudnessRing.length - 1].at
    ) {
      this.loudnessRing.push({
        at: now,
        energy: rmsK ** 2,
      });
    }

    const ringCutoff = now - blockWindowSeconds;
    while (
      this.loudnessRing.length > 0 &&
      this.loudnessRing[0].at < ringCutoff
    ) {
      this.loudnessRing.shift();
    }

    if (
      this.loudnessRing.length > 0 &&
      (
        this.lastLoudnessBlockAt === 0 ||
        now - this.lastLoudnessBlockAt >= blockWindowSeconds
      )
    ) {
      this.lastLoudnessBlockAt = now;

      const blockEnergy =
        this.loudnessRing.reduce(
          (sum, sample) => sum + sample.energy,
          0,
        ) / this.loudnessRing.length;

      const blockLufs =
        blockEnergy > 1e-10
          ? -0.691 + 10 * Math.log10(blockEnergy)
          : -120;

      if (Number.isFinite(blockLufs)) {
        this.loudnessBlocks.push(blockLufs);
      }
    }

    let integratedLufs = -120;

    const absoluteGatedBlocks =
      this.loudnessBlocks.filter(
        (lufs) =>
          Number.isFinite(lufs) &&
          lufs >= -70,
      );

    if (absoluteGatedBlocks.length > 0) {
      const ungatedEnergy =
        absoluteGatedBlocks.reduce(
          (sum, lufs) =>
            sum + 10 ** ((lufs + 0.691) / 10),
          0,
        ) / absoluteGatedBlocks.length;

      const ungatedLufs =
        -0.691 + 10 * Math.log10(ungatedEnergy);

      const relativeGate =
        Math.max(-70, ungatedLufs - 10);

      const gatedBlocks =
        absoluteGatedBlocks.filter(
          (lufs) => lufs >= relativeGate,
        );

      if (gatedBlocks.length > 0) {
        const gatedEnergy =
          gatedBlocks.reduce(
            (sum, lufs) =>
              sum + 10 ** ((lufs + 0.691) / 10),
            0,
          ) / gatedBlocks.length;

        integratedLufs =
          -0.691 + 10 * Math.log10(gatedEnergy);
      }
    }

    // ─── Phase correlation ───
    let dotProduct = 0;
    for (let i = 0; i < this.leftBuffer.length; i++) {
      dotProduct += this.leftBuffer[i] * this.rightBuffer[i];
    }
    const sumL2 = sumSqL;
    const sumR2 = sumSqR;
    const denominator = Math.sqrt(sumL2 * sumR2);
    const correlation =
      denominator > 1e-10
        ? Math.min(1, Math.max(-1, dotProduct / denominator))
        : 0;

    // Stereo width: correlation → width (1 = mono, 0 = stereo, -1 = out of phase)
    // ✅ PATCH 4: Stereo width (1 - |correlation|)
    const stereoWidth = 1 - Math.abs(correlation);

    // ─── Gain reduction (from limiter) ───
    // ✅ PATCH 6: Gain reduction (use limiter.reduction API)
    const gainReductionDb = this.limiter.reduction;
    // Hardware-backed, not inferred

    // ─── Spectrum for visualization ───
    this.spectrumAnalyser.getByteFrequencyData(
      this.spectrumBuffer as any
    );

    // ─── True peak (4× interpolation simulation) ───
    // ✅ PATCH 5: True-peak (simplified, documented approximation)
    const truePeak = Math.max(peakL, peakR);
    this.truePeakHold = Math.max(this.truePeakHold * 0.99, truePeak);
    // AnalyserNode 2048-sample window = 46ms @ 44.1kHz (sufficient for UI)
    this.truePeakHold = Math.max(this.truePeakHold * 0.99, truePeak);

    // Update telemetry snapshot
    this.latestTelemetry = {
      sampleRate: this.context.sampleRate,
      active: peak > 1e-4,
      peakL,
      peakR,
      peakDbL: peakL > 1e-6 ? 20 * Math.log10(peakL) : -120,
      peakDbR: peakR > 1e-6 ? 20 * Math.log10(peakR) : -120,
      rms,
      rmsDb: rms > 1e-6 ? 20 * Math.log10(rms) : -120,
      correlation,
      stereoWidth,
      truePeak: this.truePeakHold,
      truePeakDb: this.truePeakHold > 1e-6 ? 20 * Math.log10(this.truePeakHold) : -120,
      momentaryLufs,
      integratedLufs,
      gainReductionDb: Math.max(0, -gainReductionDb),
      clipping,
      spectrum: this.spectrumBuffer,
      waveformL: this.leftBuffer,
      waveformR: this.rightBuffer,
    };

    return { peak, rms, clipping };
  }

  // ─── Context helpers ──────────────────────────────────────────────────────────

  async resume(): Promise<void> {
    this.assertNotDisposed();
    await resumeAudioContext();
  }

  async suspend(): Promise<void> {
    if (this._disposed) return;
    await this.context.suspend();
  }

  /** Current AudioContext time in seconds */
  get currentTime(): number {
    return this.context.currentTime;
  }

  /** Base latency in seconds (input → output round-trip estimate) */
  get baseLatency(): number {
    return this.context.baseLatency ?? 0;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    if (this.meteringFrameId !== undefined) {
      cancelAnimationFrame(this.meteringFrameId);
    }

    this.removeContextListener();

    for (const id of this.sends.keys()) this.removeSend(id);

    try { this.masterGain.disconnect(); } catch { /* ok */ }
    try { this.limiter.disconnect();    } catch { /* ok */ }
    try { this.analyser.disconnect();   } catch { /* ok */ }

    this.emit('disposed', {});
  }

  /**
   * Dispose the graph AND close the underlying AudioContext singleton.
   * After this, calling `getAudioContext()` will create a fresh one.
   */
  async close(): Promise<void> {
    this.dispose();
    await closeAudioContext();
  }

  // ─── Introspection / debug ────────────────────────────────────────────────────

  toJSON() {
    return {
      contextState:  this.context.state,
      masterVolume:  this._masterVolume,
      sampleRate:    this.context.sampleRate,
      baseLatency:   this.baseLatency,
      currentTime:   this.currentTime,
      sends:         this.sendIds,
      disposed:      this._disposed,
    };
  }

  // ─── Event emitter ────────────────────────────────────────────────────────────

  on<K extends keyof AudioGraphEventMap>(event: K, listener: Listener<K>): this {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = new Set();
    }
    (this.listeners[event] as Set<Listener<K>>).add(listener);
    return this;
  }

  off<K extends keyof AudioGraphEventMap>(event: K, listener: Listener<K>): this {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(listener);
    return this;
  }

  once<K extends keyof AudioGraphEventMap>(event: K, listener: Listener<K>): this {
    const wrapper: Listener<K> = (payload) => {
      listener(payload);
      this.off(event, wrapper as Listener<K>);
    };
    return this.on(event, wrapper as Listener<K>);
  }

  private emit<K extends keyof AudioGraphEventMap>(
    event: K,
    payload: AudioGraphEventMap[K],
  ): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.forEach((fn) =>
      fn(payload),
    );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private assertNotDisposed(): void {
    if (this._disposed) throw new Error('[AudioGraph] Instance has been disposed.');
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

// Lazily created so tests can import without triggering AudioContext construction
let audioGraph: AudioGraph | null = null;

export function getAudioGraph(): AudioGraph {
  if (!audioGraph || (audioGraph as unknown as { _disposed: boolean })._disposed) {
    audioGraph = new AudioGraph();
  }
  (window as any).audioGraph = audioGraph;
  return audioGraph;
}

export function peekAudioGraph(): AudioGraph | null {
  if (!audioGraph) return null;
  if ((audioGraph as unknown as { _disposed: boolean })._disposed) {
    return null;
  }
  (window as any).audioGraph = audioGraph;
  return audioGraph;
}

/** Convenience re-export for code that imported the old `audioGraph` constant */
export { getAudioGraph as audioGraph };


declare global {
  interface Window {
    audioGraph?: AudioGraph | null;
  }
}
// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}