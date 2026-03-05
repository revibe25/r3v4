import { describe, it, expect } from 'vitest';
import { scoreTransition, rankTransitions, DEFAULT_WEIGHTS } from '../src/scoreModel';
import type { TrackSignal } from '../src/types';

const TRACK_A: TrackSignal = { bpm: 128, key: '8A', energy: 0.75, spectralCentroid: 3200, rmsLoudness: 0.65 };
const TRACK_B: TrackSignal = { bpm: 128, key: '8A', energy: 0.70, spectralCentroid: 3100, rmsLoudness: 0.60 };
const TRACK_C: TrackSignal = { bpm: 90,  key: '1A', energy: 0.20, spectralCentroid: 1000, rmsLoudness: 0.30 };

describe('scoreTransition', () => {
  it('scores identical signals near 1.0', () => {
    const result = scoreTransition(TRACK_A, TRACK_A, 'a', 'a2', DEFAULT_WEIGHTS);
    expect(result.score).toBeGreaterThan(0.85);
  });

  it('scores compatible keys higher than incompatible', () => {
    const compatible   = scoreTransition(TRACK_A, TRACK_B, 'a', 'b', DEFAULT_WEIGHTS);
    const incompatible = scoreTransition(TRACK_A, TRACK_C, 'a', 'c', DEFAULT_WEIGHTS);
    expect(compatible.score).toBeGreaterThan(incompatible.score);
  });

  it('returns score in 0.0–1.0 range', () => {
    const result = scoreTransition(TRACK_A, TRACK_C, 'a', 'c', DEFAULT_WEIGHTS);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('produces breakdown with all five dimensions', () => {
    const { breakdown } = scoreTransition(TRACK_A, TRACK_B, 'a', 'b', DEFAULT_WEIGHTS);
    expect(Object.keys(breakdown)).toEqual(['harmonic', 'energy', 'spectral', 'phase', 'tempo']);
  });

  it('selects shorter crossfade for high-scoring transitions', () => {
    const good = scoreTransition(TRACK_A, TRACK_B, 'a', 'b', DEFAULT_WEIGHTS);
    const poor = scoreTransition(TRACK_A, TRACK_C, 'a', 'c', DEFAULT_WEIGHTS);
    expect(good.suggestedCrossfadeDurationMs).toBeLessThan(poor.suggestedCrossfadeDurationMs);
  });
});

describe('rankTransitions', () => {
  it('returns candidates in descending score order', () => {
    const ranked = rankTransitions(TRACK_A, 'a', [
      { id: 'b', signal: TRACK_B },
      { id: 'c', signal: TRACK_C },
    ]);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('excludes self from candidates', () => {
    const ranked = rankTransitions(TRACK_A, 'a', [
      { id: 'a', signal: TRACK_A },
      { id: 'b', signal: TRACK_B },
    ]);
    expect(ranked.every(r => r.toTrackId !== 'a')).toBe(true);
  });
});
