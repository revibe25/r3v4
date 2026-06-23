// ─────────────────────────────────────────────────────────────
// packages/llpte-ai/src/AutoLevelEngine.test.ts
//
// Vitest unit tests for the AI Auto-Level Engine.
// Aligned to shared/auto-level.types.ts — canonical source of truth.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { AutoLevelEngine } from './AutoLevelEngine';
import type { MixSnapshot, TrackSignalSnapshot } from '@shared/auto-level.types';

// ── Helpers ────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;
const FFT_BINS    = 128;

function makeSpectrum(energy = 0.3): Float32Array {
  const s = new Float32Array(FFT_BINS);
  s.fill(energy);
  return s;
}

function makeTrack(
  overrides: Partial<TrackSignalSnapshot> = {},
  trackId = 'KICK',
): TrackSignalSnapshot {
  return {
    trackId,
    timestamp:      performance.now(),
    rms:            0.3,
    truePeak:       -6,
    shortTermLufs:  -18,
    integratedLufs: -18,
    spectrum:       makeSpectrum(0.3),
    clipping:       false,
    gateOpen:       true,
    ...overrides,
  };
}

function makeSnapshot(tracks: TrackSignalSnapshot[]): MixSnapshot {
  return {
    frameId:    1,
    timestamp:  performance.now(),
    tracks:     new Map(tracks.map(t => [t.trackId, t])),
    masterRMS:  0.35,
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
        makeTrack({ truePeak:  0.2 }, 'KICK'), // above threshold
        makeTrack({ truePeak: -3.0 }, 'BASS'), // safe
      ]);

      const rec = engine.analyze(snapshot);

      expect(rec.clippingAlerts).toContain('KICK');
      expect(rec.clippingAlerts).not.toContain('BASS');
    });

    it('emergency cuts gain on clipping track with high confidence', () => {
      const snapshot = makeSnapshot([
        makeTrack({ truePeak: 2.0 }, 'KICK'),
      ]);

      const rec = engine.analyze(snapshot);
      const kickAdj = rec.gainAdjustments.find(a => a.trackId === 'KICK');

      expect(kickAdj).toBeDefined();
      expect(kickAdj!.deltaDb).toBeLessThan(0);       // must cut
      expect(kickAdj!.confidence).toBeGreaterThan(0.9); // high confidence
    });

    it('clipping track appears in clippingAlerts', () => {
      const snapshot = makeSnapshot([
        makeTrack({ truePeak: 0.5 }, 'KICK'),
      ]);

      const rec = engine.analyze(snapshot);
      expect(rec.clippingAlerts).toContain('KICK');
      expect(rec.clippingAlerts).toHaveLength(1);
    });
  });

  // ── Gain Balancing ────────────────────────────────────────────

  describe('gain balancing', () => {
    it('suggests gain boost for quiet tracks', () => {
      const snapshot = makeSnapshot([
        makeTrack({ shortTermLufs: -30, rms: 0.05 }, 'VOCAL'),
      ]);

      const rec = engine.analyze(snapshot);
      const vocalAdj = rec.gainAdjustments.find(a => a.trackId === 'VOCAL');

      expect(vocalAdj).toBeDefined();
      expect(vocalAdj!.deltaDb).toBeGreaterThan(0);
    });

    it('suggests gain cut for loud tracks', () => {
      const snapshot = makeSnapshot([
        makeTrack({ shortTermLufs: -6, truePeak: -2 }, 'SYNTH'),
      ]);

      const rec = engine.analyze(snapshot);
      const synthAdj = rec.gainAdjustments.find(a => a.trackId === 'SYNTH');

      expect(synthAdj).toBeDefined();
      expect(synthAdj!.deltaDb).toBeLessThan(0);
    });

    it('skips silent tracks (LUFS below -60)', () => {
      const snapshot = makeSnapshot([
        makeTrack({ shortTermLufs: -80, rms: 0.0001 }, 'EMPTY'),
      ]);

      const rec = engine.analyze(snapshot);
      const emptyAdj = rec.gainAdjustments.find(a => a.trackId === 'EMPTY');
      expect(emptyAdj).toBeUndefined();
    });

    it('does not boost beyond max gain limit', () => {
      const snapshot = makeSnapshot([
        makeTrack({ shortTermLufs: -40, rms: 0.01 }, 'QUIET'),
      ]);

      const rec = engine.analyze(snapshot);
      const adj = rec.gainAdjustments.find(a => a.trackId === 'QUIET');

      if (adj) {
        expect(adj.deltaDb).toBeLessThanOrEqual(6); // maxGainBoostdB
      }
    });

    it('does not cut below max gain cut limit', () => {
      const snapshot = makeSnapshot([
        makeTrack({ shortTermLufs: -3, truePeak: -1 }, 'LOUD'),
      ]);

      const rec = engine.analyze(snapshot);
      const adj = rec.gainAdjustments.find(a => a.trackId === 'LOUD');

      if (adj) {
        expect(adj.deltaDb).toBeGreaterThanOrEqual(-12); // maxGainCutdB
      }
    });
  });

  // ── Frequency Masking ─────────────────────────────────────────

  describe('frequency masking detection', () => {
    it('detects masking when two tracks have high energy in same band', () => {
      const highBass = makeSpectrum(0);
      for (let i = 2; i <= 7; i++) highBass[i] = 0.9;

      const snapshot = makeSnapshot([
        makeTrack({ spectrum: highBass },         'KICK'),
        makeTrack({ spectrum: highBass.slice() }, 'BASS'),
      ]);

      const rec = engine.analyze(snapshot);

      expect(rec.spectralMasking.length).toBeGreaterThan(0);
      const pair = rec.spectralMasking.find(
        m => (m.trackA === 'KICK' && m.trackB === 'BASS') ||
             (m.trackA === 'BASS' && m.trackB === 'KICK'),
      );
      expect(pair).toBeDefined();
    });

    it('does not flag masking for tracks with different spectral content', () => {
      const bassHeavy = makeSpectrum(0);
      bassHeavy[2] = 0.9; bassHeavy[3] = 0.9;

      const trebleHeavy = makeSpectrum(0);
      trebleHeavy[90] = 0.9; trebleHeavy[100] = 0.9;

      const snapshot = makeSnapshot([
        makeTrack({ spectrum: bassHeavy },    'BASS'),
        makeTrack({ spectrum: trebleHeavy }, 'HI_HAT'),
      ]);

      const rec = engine.analyze(snapshot);
      expect(rec.spectralMasking).toHaveLength(0);
    });

    it('generates EQ suggestions for masked tracks', () => {
      const highBass = makeSpectrum(0);
      for (let i = 2; i <= 8; i++) highBass[i] = 0.95;

      const snapshot = makeSnapshot([
        makeTrack({ spectrum: highBass },         'KICK'),
        makeTrack({ spectrum: highBass.slice() }, 'BASS'),
      ]);

      const rec = engine.analyze(snapshot);
      expect(rec.eqSuggestions.length).toBeGreaterThan(0);
    });
  });

  // ── Dynamic Imbalance ─────────────────────────────────────────

  describe('dynamic imbalance detection', () => {
    it('completes analysis without error for large RMS spread', () => {
      const snapshot = makeSnapshot([
        makeTrack({ rms: 0.9  }, 'LOUD'),
        makeTrack({ rms: 0.008 }, 'QUIET'),
      ]);

      expect(() => engine.analyze(snapshot)).not.toThrow();
    });

    it('returns valid recommendation for balanced mixes', () => {
      const snapshot = makeSnapshot([
        makeTrack({ rms: 0.4  }, 'KICK'),
        makeTrack({ rms: 0.35 }, 'BASS'),
        makeTrack({ rms: 0.3  }, 'SYNTH'),
      ]);

      const rec = engine.analyze(snapshot);
      expect(rec.gainAdjustments).toBeDefined();
      expect(rec.overallConfidence).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Inference Performance ──────────────────────────────────────

  describe('inference performance', () => {
    it('completes analysis in ≤15ms for 8 tracks', () => {
      const tracks = ['KICK','BASS','SYNTH','CHORD','VOCAL','FX','AI_MIX','MASTER']
        .map(id => makeTrack({ trackId: id }, id));

      const snapshot = makeSnapshot(tracks);
      const start    = performance.now();
      const rec      = engine.analyze(snapshot);
      const elapsed  = performance.now() - start;

      expect(elapsed).toBeLessThan(15);
      expect(rec.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('reports processing time in the recommendation', () => {
      const snapshot = makeSnapshot([makeTrack()]);
      const rec      = engine.analyze(snapshot);
      expect(typeof rec.processingTimeMs).toBe('number');
      expect(rec.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Confidence ────────────────────────────────────────────────

  describe('confidence scoring', () => {
    it('returns high confidence (>0.9) for clipping emergency cuts', () => {
      const snapshot = makeSnapshot([
        makeTrack({ truePeak: 1.5 }, 'KICK'),
      ]);

      const rec  = engine.analyze(snapshot);
      const kick = rec.gainAdjustments.find(a => a.trackId === 'KICK');
      expect(kick?.confidence).toBeGreaterThan(0.9);
    });

    it('filters out suggestions below minimum confidence', () => {
      const snapshot = makeSnapshot([
        makeTrack({ shortTermLufs: -14.2 }, 'SYNTH'),
      ]);

      const rec = engine.analyze(snapshot);
      const adj = rec.gainAdjustments.find(a => a.trackId === 'SYNTH');
      if (adj) {
        expect(adj.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  // ── State Management ──────────────────────────────────────────

  describe('state management', () => {
    it('reset() clears smoothed gain state without throwing', () => {
      const snapshot = makeSnapshot([makeTrack()]);
      engine.analyze(snapshot);
      expect(() => engine.reset()).not.toThrow();
    });
  });
});
