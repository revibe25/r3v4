// ─────────────────────────────────────────────────────────────
// packages/llpte-signal/src/analyzers/TrackAnalyzer.ts
//
// Captures real-time RMS, LUFS, true peak, and spectral data
// from Web Audio API AnalyserNode feeds.
//
// Designed to run inside an AudioWorklet or requestAnimationFrame
// loop — must complete in <2ms per frame to stay within LLPTE budget.
// ─────────────────────────────────────────────────────────────

import type {
  TrackId,
  TrackSignalSnapshot,
  MixSnapshot,
} from './types/signal.types';

// ── Constants ────────────────────────────────────────────────

const FFT_SIZE = 256;                        // 128 usable bins
const LUFS_TARGET = -14;                     // Streaming standard
const LUFS_INTEGRATED_WINDOW_MS = 400;       // Short-term LUFS window
const CLIPPING_THRESHOLD_DBFS = -0.5;        // True peak clipping threshold
const DB_MIN = -96;                          // Noise floor

// ── Utilities ────────────────────────────────────────────────

/** Convert linear amplitude to dBFS */
function linearTodBFS(linear: number): number {
  if (linear <= 0) return DB_MIN;
  return 20 * Math.log10(linear);
}

/** Convert dBFS to linear amplitude */
function dBFSToLinear(dBFS: number): number {
  return Math.pow(10, dBFS / 20);
}

/** Compute RMS from a Float32Array of samples */
function computeRMS(samples: Float32Array): number {
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  return Math.sqrt(sumSq / samples.length);
}

/** Compute true peak (maximum absolute sample value) */
function computeTruePeak(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

// ── LUFS Meter ───────────────────────────────────────────────

/**
 * Implements a simplified ITU-R BS.1770-4 LUFS meter.
 * Maintains a sliding window of RMS measurements for integration.
 */
export class LUFSMeter {
  private readonly windowMs: number;
  private readonly sampleRate: number;
  private readonly buffer: Float64Array<ArrayBuffer>;
  private bufferHead = 0;
  private bufferFull = false;

  constructor(sampleRate: number, windowMs = LUFS_INTEGRATED_WINDOW_MS) {
    this.windowMs = windowMs;
    this.sampleRate = sampleRate;
    const windowSamples = Math.ceil((sampleRate * windowMs) / 1000);
    this.buffer = new Float64Array(windowSamples);
  }

  /** Feed a new block of samples and get current LUFS measurement */
  process(samples: Float32Array): number {
    // Write each sample squared into the ring buffer
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.bufferHead] = samples[i] * samples[i];
      this.bufferHead = (this.bufferHead + 1) % this.buffer.length;
      if (this.bufferHead === 0) this.bufferFull = true;
    }

    // Mean square over the window
    const count = this.bufferFull ? this.buffer.length : this.bufferHead;
    let sum = 0;
    for (let i = 0; i < count; i++) {
      sum += this.buffer[i];
    }
    const meanSquare = count > 0 ? sum / count : 0;

    // LUFS = -0.691 + 10 * log10(sum of channel mean squares)
    // Single channel simplification:
    if (meanSquare <= 0) return -Infinity;
    return -0.691 + 10 * Math.log10(meanSquare);
  }

  reset(): void {
    this.buffer.fill(0);
    this.bufferHead = 0;
    this.bufferFull = false;
  }
}

// ── Track Analyzer ───────────────────────────────────────────

export interface TrackAnalyzerConfig {
  trackId: TrackId;
  sampleRate: number;
  /** AnalyserNode for this track's channel insert */
  analyserNode: AnalyserNode;
  /** Current gain AudioParam reference */
  gainParam: AudioParam;
  /** Optional low-cut filter reference */
  lowCutFilter?: BiquadFilterNode | null;
}

/**
 * TrackAnalyzer wraps a single track's Web Audio nodes and
 * produces TrackSignalSnapshot objects on demand.
 *
 * Call .capture() once per animation/worklet frame.
 */
export class TrackAnalyzer {
  private readonly config: TrackAnalyzerConfig;
  private readonly lufs: LUFSMeter;
  private readonly timeDomainBuffer: Float32Array<ArrayBuffer>;
  private readonly frequencyBuffer: Float32Array<ArrayBuffer>;
  private frameCount = 0;

  constructor(config: TrackAnalyzerConfig) {
    this.config = config;

    // Configure the analyser node
    config.analyserNode.fftSize = FFT_SIZE;
    config.analyserNode.smoothingTimeConstant = 0.6;
    config.analyserNode.minDecibels = -100;
    config.analyserNode.maxDecibels = 0;

    this.lufs = new LUFSMeter(config.sampleRate);
    this.timeDomainBuffer = new Float32Array(FFT_SIZE);
    this.frequencyBuffer = new Float32Array(config.analyserNode.frequencyBinCount);
  }

  /**
   * Capture a snapshot of this track's current signal state.
   * Must be called from the audio thread or rAF — target <1ms.
   */
  capture(): TrackSignalSnapshot {
    const { analyserNode, gainParam, lowCutFilter, trackId } = this.config;

    // Time domain — for RMS and peak
    analyserNode.getFloatTimeDomainData(this.timeDomainBuffer);

    // Frequency domain — for spectral analysis
    analyserNode.getFloatFrequencyData(this.frequencyBuffer);

    const rms = computeRMS(this.timeDomainBuffer);
    const truePeak = computeTruePeak(this.timeDomainBuffer);
    const shortTermLUFS = this.lufs.process(this.timeDomainBuffer);

    // Convert frequency data from dB to linear magnitude (0–1)
    // analyserNode gives us dBFS values; normalize to 0–1
    const spectrum = new Float32Array(this.frequencyBuffer.length) as Float32Array<ArrayBuffer>;
    const { minDecibels, maxDecibels } = analyserNode;
    const range = maxDecibels - minDecibels;
    for (let i = 0; i < this.frequencyBuffer.length; i++) {
      spectrum[i] = Math.max(0, (this.frequencyBuffer[i] - minDecibels) / range);
    }

    this.frameCount++;

    return {
      trackId,
      timestamp:      performance.now(),
      rms,
      integratedLufs: shortTermLUFS,
      shortTermLufs:  shortTermLUFS,
      truePeak:       linearTodBFS(truePeak),
      spectrum,
      clipping:       linearTodBFS(truePeak) >= CLIPPING_THRESHOLD_DBFS,
      gateOpen:       shortTermLUFS > -70,
    };
  }

  get id(): TrackId {
    return this.config.trackId;
  }

  dispose(): void {
    this.lufs.reset();
  }
}

// ── Mix Analyzer ─────────────────────────────────────────────

export interface MixAnalyzerConfig {
  /** Master bus analyser node */
  masterAnalyser: AnalyserNode;
  sampleRate: number;
}

/**
 * MixAnalyzer manages a collection of TrackAnalyzers and produces
 * a unified MixSnapshot each frame.
 *
 * Usage:
 *   const mix = new MixAnalyzer({ masterAnalyser, sampleRate });
 *   mix.registerTrack(trackAnalyzer);
 *   // In rAF loop:
 *   const snapshot = mix.captureFrame();
 */
export class MixAnalyzer {
  private readonly tracks = new Map<TrackId, TrackAnalyzer>();
  private readonly masterLUFS: LUFSMeter;
  private readonly masterTimeDomain: Float32Array<ArrayBuffer>;
  private readonly config: MixAnalyzerConfig;
  private frameId = 0;

  constructor(config: MixAnalyzerConfig) {
    this.config = config;
    this.masterLUFS = new LUFSMeter(config.sampleRate);
    this.masterTimeDomain = new Float32Array(FFT_SIZE);
  }

  registerTrack(analyzer: TrackAnalyzer): void {
    this.tracks.set(analyzer.id, analyzer);
  }

  unregisterTrack(trackId: TrackId): void {
    const analyzer = this.tracks.get(trackId);
    if (analyzer) {
      analyzer.dispose();
      this.tracks.delete(trackId);
    }
  }

  /**
   * Capture one analysis frame across all tracks + master bus.
   * Returns a MixSnapshot ready for the AI engine.
   */
  captureFrame(): MixSnapshot {
    const frameId = ++this.frameId;
    const timestamp  = performance.now();

    // Capture each track
    const trackSnapshots = new Map<TrackId, TrackSignalSnapshot>();
    for (const [id, analyzer] of this.tracks) {
      trackSnapshots.set(id, analyzer.capture());
    }

    // Master bus
    this.config.masterAnalyser.getFloatTimeDomainData(this.masterTimeDomain);
    const masterRMS = computeRMS(this.masterTimeDomain);
    const masterLUFS = this.masterLUFS.process(this.masterTimeDomain);

    return {
      frameId,
      timestamp,
      tracks: trackSnapshots,
      masterRMS,
      masterLUFS,
    };
  }

  /** Number of registered tracks */
  get trackCount(): number {
    return this.tracks.size;
  }

  dispose(): void {
    for (const analyzer of this.tracks.values()) {
      analyzer.dispose();
    }
    this.tracks.clear();
  }
}

// ── Exports ──────────────────────────────────────────────────

export { linearTodBFS, dBFSToLinear, computeRMS, computeTruePeak, LUFS_TARGET, CLIPPING_THRESHOLD_DBFS };
