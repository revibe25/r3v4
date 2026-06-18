// ─────────────────────────────────────────────────────────────
// packages/llpte-ai/src/AutoLevelEngine.ts
//
// Core AI inference layer — takes a MixSnapshot, returns an
// AutoLevelRecommendation conforming to shared/auto-level.types.ts.
// ─────────────────────────────────────────────────────────────

import type {
  MixSnapshot,
  TrackSignalSnapshot,
  AutoLevelRecommendation,
  GainAdjustment,
  EQSuggestion,
  EQBand,
  SpectralMaskingReport,
  TrackId,
} from '@r3vibe/shared/auto-level.types';

import {
  LUFS_TARGET,
  CLIPPING_THRESHOLD_DBFS,
  linearTodBFS,
} from '@llpte/llpte-signal';

// ── Internal-only type (not part of shared contract) ─────────

interface MixIssue {
  type:     'clipping' | 'frequency_masking' | 'dynamic_imbalance';
  trackIds: string[];
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// ── Config ───────────────────────────────────────────────────

export interface AutoLevelEngineConfig {
  targetTrackLUFS:    number;
  targetMasterLUFS:   number;
  maxGainBoostdB:     number;
  maxGainCutdB:       number;
  gainSmoothingFactor: number;
  minimumConfidence:  number;
  maskingSensitivity: number;
}

const DEFAULT_CONFIG: AutoLevelEngineConfig = {
  targetTrackLUFS:    LUFS_TARGET,
  targetMasterLUFS:   -12,
  maxGainBoostdB:     6,
  maxGainCutdB:       -12,
  gainSmoothingFactor: 0.15,
  minimumConfidence:  0.5,
  maskingSensitivity: 0.7,
};

// ── Frequency Band Definitions ───────────────────────────────

interface FrequencyBand {
  name:     string;
  eqBand:   EQBand;
  lowHz:    number;
  highHz:   number;
  binStart: number;
  binEnd:   number;
}

const FREQUENCY_BANDS: Omit<FrequencyBand, 'binStart' | 'binEnd'>[] = [
  { name: 'sub_bass', eqBand: 'low',     lowHz: 20,    highHz: 80    },
  { name: 'bass',     eqBand: 'low',     lowHz: 80,    highHz: 250   },
  { name: 'low_mid',  eqBand: 'low-mid', lowHz: 250,   highHz: 800   },
  { name: 'mid',      eqBand: 'low-mid', lowHz: 800,   highHz: 2500  },
  { name: 'high_mid', eqBand: 'high-mid',lowHz: 2500,  highHz: 6000  },
  { name: 'presence', eqBand: 'high',    lowHz: 6000,  highHz: 12000 },
  { name: 'air',      eqBand: 'high',    lowHz: 12000, highHz: 20000 },
];

function freqToBin(hz: number, sampleRate: number, fftSize: number): number {
  return Math.round((hz / (sampleRate / 2)) * (fftSize / 2));
}

function bandEnergy(spectrum: Float32Array, binStart: number, binEnd: number): number {
  let sum = 0;
  const count = binEnd - binStart + 1;
  for (let i = binStart; i <= Math.min(binEnd, spectrum.length - 1); i++) {
    sum += spectrum[i];
  }
  return count > 0 ? sum / count : 0;
}

// ── AutoLevelEngine ──────────────────────────────────────────

export class AutoLevelEngine {
  private readonly config: AutoLevelEngineConfig;
  private readonly bands:  FrequencyBand[];
  private readonly sessionId: string;
  /** Smoothed deltaDb per track — prevents frame-to-frame pumping */
  private smoothedDeltas = new Map<TrackId, number>();

  constructor(sampleRate = 44100, config: Partial<AutoLevelEngineConfig> = {}) {
    this.config    = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = `session_${Date.now()}`;
    this.bands     = FREQUENCY_BANDS.map(band => ({
      ...band,
      binStart: freqToBin(band.lowHz,  sampleRate, 256),
      binEnd:   freqToBin(band.highHz, sampleRate, 256),
    }));
  }

  analyze(snapshot: MixSnapshot): AutoLevelRecommendation {
    const inferenceStart = performance.now();

    const gainAdjustments: GainAdjustment[]      = [];
    const eqSuggestions:   EQSuggestion[]         = [];
    const spectralMasking: SpectralMaskingReport[] = [];
    const clippingAlerts:  string[]               = [];

    const tracks = Array.from(snapshot.tracks.values());

    // ── Step 1: Clipping detection ────────────────────────────
    for (const track of tracks) {
      if (track.truePeak > CLIPPING_THRESHOLD_DBFS) {
        clippingAlerts.push(track.trackId);
      }
    }

    // ── Step 2: Per-track gain balancing ──────────────────────
    for (const track of tracks) {
      const adj = this.computeGainAdjustment(track, snapshot);
      if (adj && adj.confidence >= this.config.minimumConfidence) {
        gainAdjustments.push(adj);
      }
    }

    // ── Step 3: Frequency masking ─────────────────────────────
    const maskingIssues = this.detectFrequencyMasking(tracks);
    for (const issue of maskingIssues) {
      const [idA, idB] = issue.trackIds;
      const trackA = tracks.find(t => t.trackId === idA)!;
      const trackB = tracks.find(t => t.trackId === idB)!;

      const worstBand = this.findWorstMaskingBand(trackA, trackB);
      const centerHz  = (worstBand.lowHz + worstBand.highHz) / 2;

      const aIsPrimary    = trackA.rms >= trackB.rms;
      const targetTrackId = aIsPrimary ? idB : idA;

      const eq: EQSuggestion = {
        trackId:    targetTrackId,
        band:       worstBand.eqBand,
        frequency:  centerHz,
        gain:       -3.5,
        q:          1.2,
        reason:     `Cut ${centerHz.toFixed(0)} Hz on ${targetTrackId} to reduce masking`,
        confidence: 0.65,
      };

      const report: SpectralMaskingReport = {
        trackA:      idA,
        trackB:      idB,
        maskingBand: worstBand.eqBand,
        frequency:   centerHz,
        severity:    issue.severity === 'high' ? 0.9 : 0.6,
        suggestions: [eq],
      };

      spectralMasking.push(report);
      eqSuggestions.push(eq);
    }

    // ── Step 4: Dynamic imbalance (internal signal only) ─────
    this.detectDynamicImbalance(tracks);

    const confidences = gainAdjustments.map(a => a.confidence);
    const overallConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    return {
      sessionId:       this.sessionId,
      frameId:         snapshot.frameId,
      timestamp:       performance.now(),
      gainAdjustments,
      eqSuggestions,
      spectralMasking,
      clippingAlerts,
      overallConfidence,
      processingTimeMs: performance.now() - inferenceStart,
    };
  }

  // ── Private Methods ────────────────────────────────────────

  private computeGainAdjustment(
    track: TrackSignalSnapshot,
    snapshot: MixSnapshot,
  ): GainAdjustment | null {
    const currentLUFS = track.shortTermLufs;
    if (currentLUFS < -60 || !isFinite(currentLUFS)) return null;

    const deltaLUFS = this.config.targetTrackLUFS - currentLUFS;

    let deltaDb:  number;
    let confidence: number;
    let reason:   string;
    let urgency:  GainAdjustment['urgency'];

    if (track.truePeak > CLIPPING_THRESHOLD_DBFS) {
      deltaDb    = CLIPPING_THRESHOLD_DBFS - track.truePeak - 1.0;
      confidence = 0.97;
      reason     = `Clipping detected — reducing gain by ${Math.abs(deltaDb).toFixed(1)} dB`;
      urgency    = 'immediate';
    } else if (Math.abs(deltaLUFS) < 0.5) {
      return null;
    } else {
      deltaDb = Math.max(
        this.config.maxGainCutdB,
        Math.min(this.config.maxGainBoostdB, deltaLUFS),
      );
      confidence = Math.max(0.5, 1.0 - Math.abs(deltaDb) / 12);
      if (Math.abs(snapshot.masterLUFS - this.config.targetMasterLUFS) < 1.0) {
        confidence *= 0.85;
      }
      reason = deltaLUFS > 0
        ? `Track ${Math.abs(deltaLUFS).toFixed(1)} LUFS quiet — boost ${deltaDb.toFixed(1)} dB`
        : `Track ${Math.abs(deltaLUFS).toFixed(1)} LUFS loud — cut ${Math.abs(deltaDb).toFixed(1)} dB`;
      urgency = Math.abs(deltaDb) > 3 ? 'gradual' : 'suggestion';
    }

    // Smooth between frames to prevent pumping
    const prev     = this.smoothedDeltas.get(track.trackId) ?? deltaDb;
    const smoothed = prev + (deltaDb - prev) * this.config.gainSmoothingFactor;
    this.smoothedDeltas.set(track.trackId, smoothed);

    return {
      trackId:          track.trackId,
      currentGainDb:    0,         // executor reads live GainNode.gain.value
      recommendedGainDb: smoothed,
      deltaDb:          smoothed,
      confidence,
      reason,
      urgency,
    };
  }

  private detectFrequencyMasking(tracks: TrackSignalSnapshot[]): MixIssue[] {
    const issues: MixIssue[] = [];
    for (let i = 0; i < tracks.length; i++) {
      for (let j = i + 1; j < tracks.length; j++) {
        const A = tracks[i];
        const B = tracks[j];
        for (const band of this.bands) {
          const eA = bandEnergy(A.spectrum, band.binStart, band.binEnd);
          const eB = bandEnergy(B.spectrum, band.binStart, band.binEnd);
          const threshold = this.config.maskingSensitivity * 0.4;
          if (eA > threshold && eB > threshold) {
            const overlap = Math.min(eA, eB) / Math.max(eA, eB);
            if (overlap > 0.6) {
              issues.push({
                type:        'frequency_masking',
                trackIds:    [A.trackId, B.trackId],
                severity:    overlap > 0.85 ? 'high' : 'medium',
                description: `${A.trackId} and ${B.trackId} compete in ${band.name}`,
              });
            }
          }
        }
      }
    }
    return issues;
  }

  private findWorstMaskingBand(
    trackA: TrackSignalSnapshot,
    trackB: TrackSignalSnapshot,
  ): FrequencyBand {
    let worst       = this.bands[0];
    let worstOverlap = 0;
    for (const band of this.bands) {
      const eA = bandEnergy(trackA.spectrum, band.binStart, band.binEnd);
      const eB = bandEnergy(trackB.spectrum, band.binStart, band.binEnd);
      const overlap = Math.min(eA, eB);
      if (overlap > worstOverlap) { worstOverlap = overlap; worst = band; }
    }
    return worst;
  }

  private detectDynamicImbalance(tracks: TrackSignalSnapshot[]): void {
    if (tracks.length < 2) return;
    const rmsValues = tracks.map(t => t.rms).filter(r => r > 0.001);
    if (rmsValues.length < 2) return;
    const maxRMS = Math.max(...rmsValues);
    const minRMS = Math.min(...rmsValues);
    // Surface via gain adjustments only — no dedicated output type
    void (linearTodBFS(maxRMS) - linearTodBFS(minRMS));
  }

  reset(): void {
    this.smoothedDeltas.clear();
  }
}
