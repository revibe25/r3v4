/**
 * scoreModel.test.ts  (src/__tests__)
 *
 * Canonical test file: packages/llpte-transition-graph/tests/scoreModel.test.ts
 *
 * This file retains ONLY coverage not present in the canonical file:
 *   - BPM sensitivity: ±2 beats scores higher than ±20 beats
 *
 * All other behavioral assertions (score range, key compatibility, breakdown
 * shape, crossfade selection, self-exclusion, sort order) are covered by the
 * canonical file and are not duplicated here per the zero-redundancy policy.
 *
 * API reference (verified against src/scoreModel.ts):
 *   scoreTransition(from, to, fromId, toId, weights?) → TransitionCandidate
 *   rankTransitions(from, fromId, candidates, weights?) → TransitionCandidate[]
 *   TransitionCandidate.score     — composite score, 0.0–1.0
 *   TransitionCandidate.toTrackId — id of the incoming track
 */
import { describe, it, expect } from 'vitest';
import { scoreTransition, rankTransitions, DEFAULT_WEIGHTS } from '../scoreModel';
import type { TrackSignal } from '../types';

/**
 * Full-shape track factory.
 * Uses Camelot notation ('8A') and includes all required TrackSignal fields
 * so no scoring dimension silently hits its undefined/zero fallback branch.
 */
const track = (overrides: Partial<TrackSignal> = {}): TrackSignal => ({
  bpm:              128,
  key:              '8A',
  energy:           0.70,
  spectralCentroid: 3200,
  rmsLoudness:      0.65,
  ...overrides,
});

// ── BPM sensitivity — unique coverage not in tests/scoreModel.test.ts ─────────

describe('scoreTransition — BPM sensitivity', () => {
  it('BPM difference of ±2 scores higher than ±20', () => {
    // All dimensions identical except BPM — isolates tempo contribution
    const close = scoreTransition(track({ bpm: 128 }), track({ bpm: 130 }), 'a', 'b', DEFAULT_WEIGHTS);
    const far   = scoreTransition(track({ bpm: 128 }), track({ bpm: 148 }), 'a', 'c', DEFAULT_WEIGHTS);
    expect(close.score).toBeGreaterThan(far.score);
  });

  it('the best BPM match is ranked first when all other dimensions are equal', () => {
    const from       = track({ bpm: 128 });
    const fromId     = 'source';
    const candidates = [
      { id: 'bad',      signal: track({ bpm: 160 }) },  // 32 BPM off
      { id: 'good',     signal: track({ bpm: 129 }) },  // 1  BPM off
      { id: 'mediocre', signal: track({ bpm: 145 }) },  // 17 BPM off
    ];

    const ranked = rankTransitions(from, fromId, candidates, DEFAULT_WEIGHTS);
    expect(ranked[0].toTrackId).toBe('good');
  });
});
