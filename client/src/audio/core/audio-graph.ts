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
    return this.computeMeter();
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

  private computeMeter(): MeterReading {
    this.analyser.getFloatTimeDomainData(this.analyserBuffer as Float32Array<ArrayBuffer>);

    let peak = 0;
    let sumSq = 0;

    for (let i = 0; i < this.analyserBuffer.length; i++) {
      const abs = Math.abs(this.analyserBuffer[i]);
      if (abs > peak) peak = abs;
      sumSq += abs * abs;
    }

    const rms  = Math.sqrt(sumSq / this.analyserBuffer.length);
    return { peak, rms, clipping: peak >= 1.0 };
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
  if (!_audioGraph || (_audioGraph as unknown as { _disposed: boolean })._disposed) {
    _audioGraph = new AudioGraph();
  }
  return _audioGraph;
}

/** Convenience re-export for code that imported the old `audioGraph` constant */
export { getAudioGraph as audioGraph };

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}