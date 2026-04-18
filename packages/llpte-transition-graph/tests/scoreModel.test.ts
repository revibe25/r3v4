import { validateSignal, normalizeWeights } from '../src/scoreModel';
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

describe('scoreTransition — phase scoring', () => {
  // Covers scoreModel.ts line 90 (validateSignal phaseOffset true branch)
  // and lines 141-145 (entire scorePhase() body).
  // Both signals must have phaseOffset defined and finite.

  const aligned  = (): TrackSignal => ({
    bpm: 128, key: '8A', energy: 0.75, spectralCentroid: 3200, rmsLoudness: 0.65,
    phaseOffset: 0,          // perfectly aligned
  });
  const opposite = (): TrackSignal => ({
    bpm: 128, key: '8A', energy: 0.75, spectralCentroid: 3200, rmsLoudness: 0.65,
    phaseOffset: Math.PI,    // fully opposite → scorePhase = 0
  });

  it('phaseOffset scores aligned phases higher than opposite phases', () => {
    const good = scoreTransition(aligned(), aligned(),   'a', 'b', DEFAULT_WEIGHTS);
    const bad  = scoreTransition(aligned(), opposite(),  'a', 'c', DEFAULT_WEIGHTS);
    // Aligned: scorePhase = 1.0. Opposite: scorePhase = 0.
    expect(good.score).toBeGreaterThan(bad.score);
  });

  it('phaseOffset is preserved through validateSignal (line 90 true branch)', () => {
    // A defined, finite phaseOffset must pass through — score is lower than aligned pair
    const result = scoreTransition(aligned(), opposite(), 'a', 'b', DEFAULT_WEIGHTS);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.breakdown).toHaveProperty('phase');
    expect(result.breakdown.phase).toBe(0); // phase(0, π) = 0
  });
});

describe('scoreTransition — linear curve selection', () => {
  // Covers scoreModel.ts lines 170-171: the 'linear' fallthrough in selectCurve.
  // Requires: energy <= 0.8, harmonic not compatible, spectral >= 0.4.
  // Verified: energy(0.7,0.4)=0.225, harmonic('1A','6A')=0.1, spectral(3200,3000)=0.906

  it('selects linear curve for low-energy incompatible-key transitions', () => {
    const from: TrackSignal = { bpm: 128, key: '1A', energy: 0.7,  spectralCentroid: 3200, rmsLoudness: 0.65 };
    const to:   TrackSignal = { bpm: 128, key: '6A', energy: 0.4,  spectralCentroid: 3000, rmsLoudness: 0.40 };
    // '1A' compatible list: ['1A','2A','12A','1B'] — '6A' not in it → harmonic = 0.1
    // energy delta 0.3 → score 0.225 (not > 0.6, not > 0.8)
    // spectral delta small → score 0.906 (>= 0.4)
    // Result: not equal-power, not s-curve, not logarithmic → linear
    const result = scoreTransition(from, to, 'a', 'b', DEFAULT_WEIGHTS);
    expect(result.suggestedCurve).toBe('linear');
  });
});
});

// ── Branch coverage: validateSignal, normalizeWeights, dimension functions ───
// These tests exercise the falsy/zero arms that valid-signal tests never reach.

describe('validateSignal — invalid input clamping', () => {
  it('validateSignal clamps invalid inputs to safe defaults', () => {
    // Drives the false-arm of every ternary in validateSignal
    const result = validateSignal({
      bpm:              NaN,       // isFinite(NaN) = false → 0
      key:              42 as any, // typeof 42 !== 'string' → ''
      energy:           Infinity,  // isFinite(Infinity) = false → 0
      spectralCentroid: -Infinity, // isFinite(-Infinity) = false → 0
      rmsLoudness:      NaN,       // isFinite(NaN) = false → 0
    });
    expect(result.bpm).toBe(0);
    expect(result.key).toBe('');
    expect(result.energy).toBe(0);
    expect(result.spectralCentroid).toBe(0);
    expect(result.rmsLoudness).toBe(0);
  });

  it('validateSignal passes through a valid phaseOffset', () => {
    const result = validateSignal({
      bpm: 128, key: '8A', energy: 0.7,
      spectralCentroid: 3200, rmsLoudness: 0.65,
      phaseOffset: 1.5,
    });
    expect(result.phaseOffset).toBe(1.5);
  });

  it('validateSignal rejects NaN phaseOffset and returns undefined', () => {
    const result = validateSignal({
      bpm: 128, key: '8A', energy: 0.7,
      spectralCentroid: 3200, rmsLoudness: 0.65,
      phaseOffset: NaN,
    });
    expect(result.phaseOffset).toBeUndefined();
  });
});

describe('normalizeWeights — zero-sum guard', () => {
  it('normalizeWeights with all-zero weights returns DEFAULT_WEIGHTS', () => {
    const result = normalizeWeights({
      harmonicWeight: 0, energyWeight: 0, spectralWeight: 0,
      phaseWeight: 0, tempoWeight: 0,
    });
    expect(result.harmonicWeight).toBe(DEFAULT_WEIGHTS.harmonicWeight);
    expect(result.energyWeight).toBe(DEFAULT_WEIGHTS.energyWeight);
    expect(result.spectralWeight).toBe(DEFAULT_WEIGHTS.spectralWeight);
  });
});

describe('scoreTransition — dimension function edge branches', () => {
  // scoreHarmonic line 117: !a.key || !b.key → 0.3
  it('empty key scores lower than matching key', () => {
    const noKey = scoreTransition(
      { bpm: 128, key: '', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      { bpm: 128, key: '8A', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      'a', 'b', DEFAULT_WEIGHTS,
    );
    const withKey = scoreTransition(
      { bpm: 128, key: '8A', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      { bpm: 128, key: '8A', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      'a', 'b', DEFAULT_WEIGHTS,
    );
    expect(noKey.score).toBeLessThan(withKey.score);
    expect(noKey.score).toBeGreaterThanOrEqual(0);
    expect(noKey.score).toBeLessThanOrEqual(1);
  });

  // scoreHarmonic line 119: CAMELOT_COMPATIBLE[a.key] ?? [] — unknown key uses fallback
  it('non-Camelot key uses the ?? [] fallback and returns a valid score', () => {
    const result = scoreTransition(
      { bpm: 128, key: 'Am', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      { bpm: 128, key: '8A', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      'a', 'b', DEFAULT_WEIGHTS,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  // scoreHarmonic line 123: parseInt close numeric keys → 0.4
  // '3' and '4' are not in CAMELOT_COMPATIBLE so ?? [] fires; then parseInt
  // gives 3 and 4, diff = 1 ≤ 2 → returns 0.4 harmonic score
  it('close non-Camelot numeric keys score higher than far ones', () => {
    const close = scoreTransition(
      { bpm: 128, key: '3', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      { bpm: 128, key: '4', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      'a', 'b', DEFAULT_WEIGHTS,
    );
    const far = scoreTransition(
      { bpm: 128, key: '3', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      { bpm: 128, key: '10', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      'a', 'b', DEFAULT_WEIGHTS,
    );
    expect(close.score).toBeGreaterThan(far.score);
  });

  // scoreSpectral line 133: spectralCentroid <= 0 → 0.5
  it('zero spectralCentroid returns the 0.5 spectral fallback', () => {
    const result = scoreTransition(
      { bpm: 128, key: '8A', energy: 0.7, spectralCentroid: 0, rmsLoudness: 0.65 },
      { bpm: 128, key: '8A', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      'a', 'b', DEFAULT_WEIGHTS,
    );
    expect(result.breakdown.spectral).toBe(0.5);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  // scoreTempo line 148: bpm <= 0 → 0.3
  it('zero bpm returns the 0.3 tempo fallback', () => {
    const result = scoreTransition(
      { bpm: 0, key: '8A', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      { bpm: 128, key: '8A', energy: 0.7, spectralCentroid: 3200, rmsLoudness: 0.65 },
      'a', 'b', DEFAULT_WEIGHTS,
    );
    expect(result.breakdown.tempo).toBe(0.3);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
