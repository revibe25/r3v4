// ─────────────────────────────────────────────────────────────
// packages/llpte-signal/src/analyzers/TrackAnalyzer.ts
//
// Real-time per-track signal analysis using Web Audio AnalyserNode.
// Produces TrackSignalSnapshot each frame for AutoLevelEngine.
// Also exports constants consumed by AutoLevelEngine.
// ─────────────────────────────────────────────────────────────

import type {
  MixSnapshot,
  TrackSignalSnapshot,
  TrackId,
} from '@r3vibe/shared/auto-level.types';
import { AUTO_LEVEL_CONSTANTS } from '@r3vibe/shared/auto-level.types';

// ── Re-exported constants (consumed by AutoLevelEngine) ──────

export const LUFS_TARGET            = AUTO_LEVEL_CONSTANTS.TARGET_LUFS;
export const CLIPPING_THRESHOLD_DBFS = AUTO_LEVEL_CONSTANTS.CLIPPING_THRESHOLD_DBTP;

export function linearTodBFS(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

export function dBFSToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

// ── TrackAnalyzer ─────────────────────────────────────────────

export interface TrackAnalyzerConfig {
  trackId: TrackId;
  analyserNode: AnalyserNode;
  sampleRate?: number;
}

export class TrackAnalyzer {
  readonly id: TrackId;
  private readonly analyserNode: AnalyserNode;
  private readonly timeDomainBuffer: Float32Array<ArrayBuffer>;

  constructor(config: TrackAnalyzerConfig) {
    this.id           = config.trackId;
    this.analyserNode = config.analyserNode;
    this.timeDomainBuffer = new Float32Array(this.analyserNode.fftSize) as unknown as Float32Array<ArrayBuffer>;
  }

  capture(timestamp: number): TrackSignalSnapshot {
    this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer);

    let sumSq = 0;
    let peak  = 0;
    for (let i = 0; i < this.timeDomainBuffer.length; i++) {
      const s = this.timeDomainBuffer[i];
      sumSq += s * s;
      const abs = Math.abs(s);
      if (abs > peak) peak = abs;
    }

    const rms          = Math.sqrt(sumSq / this.timeDomainBuffer.length);
    const truePeak     = linearTodBFS(peak);
    // ITU-R BS.1770-4 short-term approximation (3-s window not available
    // per-frame; use instantaneous RMS-weighted LUFS as proxy).
    const shortTermLufs = -0.691 + 10 * Math.log10(Math.max(rms * rms, 1e-12)) - 10;

    const spectrumBuf = new Float32Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getFloatFrequencyData(spectrumBuf);

    return {
      trackId:        this.id,
      timestamp,
      rms,
      truePeak,
      shortTermLufs,
      integratedLufs: shortTermLufs,   // full-session gate not computed here
      spectrum:       spectrumBuf,
      clipping:       peak >= 1.0,
      gateOpen:       rms > dBFSToLinear(AUTO_LEVEL_CONSTANTS.GATE_THRESHOLD_LUFS),
    };
  }

  dispose(): void { /* nothing to release */ }
}

// ── MixAnalyzer ───────────────────────────────────────────────

export class MixAnalyzer {
  private readonly masterAnalyser: AnalyserNode;
  private readonly tracks = new Map<TrackId, TrackAnalyzer>();
  private frameId = 0;

  constructor(config: { masterAnalyser: AnalyserNode; sampleRate: number }) {
    this.masterAnalyser = config.masterAnalyser;
  }

  registerTrack(analyzer: TrackAnalyzer): void {
    this.tracks.set(analyzer.id, analyzer);
  }

  unregisterTrack(trackId: TrackId): void {
    this.tracks.delete(trackId);
  }

  captureFrame(): MixSnapshot {
    const timestamp       = performance.now();
    const tracks          = new Map<TrackId, TrackSignalSnapshot>();

    for (const [id, analyzer] of this.tracks) {
      tracks.set(id, analyzer.capture(timestamp));
    }

    // Master bus RMS
    const masterBuf = new Float32Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getFloatTimeDomainData(masterBuf);
    let sumSq = 0;
    for (const s of masterBuf) sumSq += s * s;
    const masterRMS  = Math.sqrt(sumSq / masterBuf.length);
    const masterLUFS = -0.691 + 10 * Math.log10(Math.max(masterRMS * masterRMS, 1e-12)) - 10;

    return {
      frameId:    this.frameId++,
      timestamp,
      tracks,
      masterRMS,
      masterLUFS,
    };
  }

  dispose(): void {
    this.tracks.clear();
  }
}
