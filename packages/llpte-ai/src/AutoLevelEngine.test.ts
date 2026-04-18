// ─────────────────────────────────────────────────────────────
// packages/llpte-ai/src/__tests__/AutoLevelEngine.test.ts
//
// Vitest unit tests for the AI Auto-Level Engine.
// Run with: pnpm vitest
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { AutoLevelEngine } from '../AutoLevelEngine';
import type { MixSnapshot, TrackSignalSnapshot } from '../../../../shared/auto-level.types';

// ── Helpers ────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;
const FFT_BINS = 128;

function makeSpectrum(energy: number = 0.3): Float32Array {
  const spectrum = new Float32Array(FFT_BINS);
  spectrum.fill(energy);
  return spectrum;
}

function makeTrack(
  overrides: Partial<TrackSignalSnapshot> = {},
  trackId = 'KICK',
): TrackSignalSnapshot {
  return {
    trackId,
    capturedAt: performance.now(),
    rms: 0.3,
    integratedLUFS: -18,
    shortTermLUFS: -18,
    truePeakdBFS: -6,
    spectrum: makeSpectrum(0.3),
    currentGain: 1.0,
    lowCutHz: 0,
    ...overrides,
  };
}

function makeSnapshot(tracks: TrackSignalSnapshot[]): MixSnapshot {
  const trackMap = new Map(tracks.map(t => [t.trackId, t]));
  return {
    frameId: 1,
    capturedAt: performance.now(),
    tracks: trackMap,
    masterRMS: 0.35,
    masterLUFS: -14,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('AutoLevelEngine', () => {
  let engine: AutoLevelEngine;

  beforeEach(() => {
    engine = new AutoLevelEngine(SAMPLE_RATE);
  });

  // ── Clipping Detection ───────────────────────────────────────

  describe('clipping detection', () => {
    it('detects clipping when truePeak > -0.5 dBFS', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'KICK', truePeakdBFS: 0.2 }), // above threshold
        makeTrack({ trackId: 'BASS', truePeakdBFS: -3 }),   // safe
      ]);

      const rec = engine.analyze(snapshot);
      const clippingIssues = rec.detectedIssues.filter(i => i.type === 'clipping');

      expect(clippingIssues).toHaveLength(1);
      expect(clippingIssues[0].trackIds).toContain('KICK');
      expect(clippingIssues[0].trackIds).not.toContain('BASS');
    });

    it('emergency cuts gain on clipping track with high confidence', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'KICK', truePeakdBFS: 2.0, currentGain: 1.5 }),
      ]);

      const rec = engine.analyze(snapshot);
      const kickAdj = rec.adjustments.get('KICK');

      expect(kickAdj).toBeDefined();
      expect(kickAdj!.gainDeltadB).toBeLessThan(0); // must cut
      expect(kickAdj!.confidence).toBeGreaterThan(0.9); // high confidence
    });

    it('severity is high when peak is above 0 dBFS', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'KICK', truePeakdBFS: 0.5 }),
      ]);

      const rec = engine.analyze(snapshot);
      const clipping = rec.detectedIssues.find(i => i.type === 'clipping');
      expect(clipping?.severity).toBe('high');
    });
  });

  // ── Gain Balancing ────────────────────────────────────────────

  describe('gain balancing', () => {
    it('suggests gain boost for quiet tracks', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'VOCAL', shortTermLUFS: -30, rms: 0.05 }),
      ]);

      const rec = engine.analyze(snapshot);
      const vocalAdj = rec.adjustments.get('VOCAL');

      expect(vocalAdj).toBeDefined();
      expect(vocalAdj!.gainDeltadB).toBeGreaterThan(0);
    });

    it('suggests gain cut for loud tracks', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'SYNTH', shortTermLUFS: -6, truePeakdBFS: -2 }),
      ]);

      const rec = engine.analyze(snapshot);
      const synthAdj = rec.adjustments.get('SYNTH');

      expect(synthAdj).toBeDefined();
      expect(synthAdj!.gainDeltadB).toBeLessThan(0);
    });

    it('skips silent tracks (LUFS below -60)', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'EMPTY', shortTermLUFS: -80, rms: 0.0001 }),
      ]);

      const rec = engine.analyze(snapshot);
      expect(rec.adjustments.has('EMPTY')).toBe(false);
    });

    it('does not boost beyond max gain limit', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'QUIET', shortTermLUFS: -40, rms: 0.01 }),
      ]);

      const rec = engine.analyze(snapshot);
      const adj = rec.adjustments.get('QUIET');

      if (adj) {
        expect(adj.gainDeltadB).toBeLessThanOrEqual(6); // maxGainBoostdB
        expect(adj.targetGainLinear).toBeLessThanOrEqual(4); // hard cap
      }
    });

    it('does not cut below max gain cut limit', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'LOUD', shortTermLUFS: -3, truePeakdBFS: -1 }),
      ]);

      const rec = engine.analyze(snapshot);
      const adj = rec.adjustments.get('LOUD');

      if (adj) {
        expect(adj.gainDeltadB).toBeGreaterThanOrEqual(-12); // maxGainCutdB
      }
    });
  });

  // ── Frequency Masking ─────────────────────────────────────────

  describe('frequency masking detection', () => {
    it('detects masking when two tracks have high energy in same band', () => {
      const highEnergyBass = makeSpectrum(0);
      // Fill bass band (bins ~2–7) with high energy
      for (let i = 2; i <= 7; i++) highEnergyBass[i] = 0.9;

      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'KICK', spectrum: highEnergyBass }),
        makeTrack({ trackId: 'BASS', spectrum: highEnergyBass.slice() }, 'BASS'),
      ]);

      const rec = engine.analyze(snapshot);
      const masking = rec.detectedIssues.filter(i => i.type === 'frequency_masking');

      expect(masking.length).toBeGreaterThan(0);
      expect(masking.some(m => m.trackIds.includes('KICK') && m.trackIds.includes('BASS'))).toBe(true);
    });

    it('does not flag masking for tracks with different spectral content', () => {
      const bassHeavy = makeSpectrum(0);
      bassHeavy[2] = 0.9; bassHeavy[3] = 0.9; // only bass

      const trebleHeavy = makeSpectrum(0);
      trebleHeavy[90] = 0.9; trebleHeavy[100] = 0.9; // only high freq

      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'BASS', spectrum: bassHeavy }),
        makeTrack({ trackId: 'HI_HAT', spectrum: trebleHeavy }, 'HI_HAT'),
      ]);

      const rec = engine.analyze(snapshot);
      const masking = rec.detectedIssues.filter(i => i.type === 'frequency_masking');
      expect(masking).toHaveLength(0);
    });

    it('generates EQ suggestions for masked tracks', () => {
      const highBassEnergy = makeSpectrum(0);
      for (let i = 2; i <= 8; i++) highBassEnergy[i] = 0.95;

      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'KICK', spectrum: highBassEnergy }),
        makeTrack({ trackId: 'BASS', spectrum: highBassEnergy.slice() }, 'BASS'),
      ]);

      const rec = engine.analyze(snapshot);
      const hasEQSuggestion = Array.from(rec.adjustments.values())
        .some(adj => adj.eqSuggestions.length > 0);

      expect(hasEQSuggestion).toBe(true);
    });
  });

  // ── Dynamic Imbalance ─────────────────────────────────────────

  describe('dynamic imbalance detection', () => {
    it('detects >20dB imbalance between tracks', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'LOUD', rms: 0.9 }),
        makeTrack({ trackId: 'QUIET', rms: 0.008 }, 'QUIET'), // ~>20dB gap
      ]);

      const rec = engine.analyze(snapshot);
      const imbalance = rec.detectedIssues.find(i => i.type === 'dynamic_imbalance');
      expect(imbalance).toBeDefined();
    });

    it('does not flag balanced mixes', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'KICK', rms: 0.4 }),
        makeTrack({ trackId: 'BASS', rms: 0.35 }, 'BASS'),
        makeTrack({ trackId: 'SYNTH', rms: 0.3 }, 'SYNTH'),
      ]);

      const rec = engine.analyze(snapshot);
      const imbalance = rec.detectedIssues.find(i => i.type === 'dynamic_imbalance');
      expect(imbalance).toBeUndefined();
    });
  });

  // ── Inference Performance ──────────────────────────────────────

  describe('inference performance', () => {
    it('completes analysis in ≤15ms for 8 tracks', () => {
      const tracks = ['KICK', 'BASS', 'SYNTH', 'CHORD', 'VOCAL', 'FX', 'AI_MIX', 'MASTER']
        .map(id => makeTrack({ trackId: id }, id));

      const snapshot = makeSnapshot(tracks);

      const start = performance.now();
      const rec = engine.analyze(snapshot);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(15); // LLPTE requirement
      expect(rec.inferenceTimeMs).toBeGreaterThan(0);
    });

    it('reports inference time in the recommendation', () => {
      const snapshot = makeSnapshot([makeTrack()]);
      const rec = engine.analyze(snapshot);
      expect(rec.inferenceTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof rec.inferenceTimeMs).toBe('number');
    });
  });

  // ── Confidence ────────────────────────────────────────────────

  describe('confidence scoring', () => {
    it('returns high confidence (>0.9) for clipping emergency cuts', () => {
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'KICK', truePeakdBFS: 1.5 }),
      ]);

      const rec = engine.analyze(snapshot);
      expect(rec.adjustments.get('KICK')?.confidence).toBeGreaterThan(0.9);
    });

    it('filters out suggestions below minimum confidence', () => {
      // borderline track — very slight deviation
      const snapshot = makeSnapshot([
        makeTrack({ trackId: 'SYNTH', shortTermLUFS: -14.2 }), // almost at target
      ]);

      const rec = engine.analyze(snapshot);
      // Either no adjustment or it passes the confidence threshold
      const adj = rec.adjustments.get('SYNTH');
      if (adj) {
        expect(adj.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  // ── Reset ─────────────────────────────────────────────────────

  describe('state management', () => {
    it('reset() clears smoothed gain state without throwing', () => {
      const snapshot = makeSnapshot([makeTrack()]);
      engine.analyze(snapshot);
      expect(() => engine.reset()).not.toThrow();
    });
  });
});
