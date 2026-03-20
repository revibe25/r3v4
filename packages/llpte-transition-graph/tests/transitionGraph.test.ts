import { describe, it, expect, beforeEach } from 'vitest';
import { LLPTETransitionGraph } from '../src/transitionGraph';
import type { TrackSignal } from '../src/types';

const mkSignal = (bpm: number, key: string): TrackSignal => ({
  bpm, key, energy: 0.7, spectralCentroid: 3000, rmsLoudness: 0.6,
});

describe('LLPTETransitionGraph', () => {
  let graph: LLPTETransitionGraph;
  beforeEach(() => { graph = new LLPTETransitionGraph(); });

  // ── existing tests (unchanged) ────────────────────────────────────────────

  it('starts empty', () => { expect(graph.size()).toBe(0); });

  it('adds tracks and returns candidates', () => {
    graph.addTrack('a', mkSignal(128, '8A'));
    graph.addTrack('b', mkSignal(128, '9A'));
    graph.addTrack('c', mkSignal(128, '1A'));
    expect(graph.size()).toBe(3);
    const best = graph.getBestNext('a');
    expect(best).not.toBeNull();
    expect(best?.toTrackId).toBeTruthy();
  });

  it('removes tracks cleanly', () => {
    graph.addTrack('a', mkSignal(128, '8A'));
    graph.addTrack('b', mkSignal(128, '9A'));
    graph.removeTrack('b');
    expect(graph.size()).toBe(1);
    expect(graph.getBestNext('a')).toBeNull();
  });

  it('serializes and deserializes correctly', () => {
    graph.addTrack('a', mkSignal(128, '8A'));
    graph.addTrack('b', mkSignal(130, '9A'));
    const data = graph.serialize() as { tracks: Record<string, TrackSignal> };
    const restored = LLPTETransitionGraph.deserialize({ tracks: data.tracks });
    expect(restored.size()).toBe(2);
  });

  // ── new tests: previously uncovered paths ─────────────────────────────────

  // covers lines 57-58: trackIds()
  it('trackIds returns all track IDs', () => {
    graph.addTrack('a', mkSignal(128, '8A'));
    graph.addTrack('b', mkSignal(128, '9A'));
    const ids = graph.trackIds();
    expect(ids).toHaveLength(2);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });

  // covers lines 49-50: getBestNext() ?? null branch — no candidates exist
  it('getBestNext returns null when the only track has no candidates', () => {
    graph.addTrack('solo', mkSignal(128, '8A'));
    // single track has no outgoing edges — getBestTransitions returns []
    // [].slice(0,1)[0] === undefined — ?? null fires
    expect(graph.getBestNext('solo')).toBeNull();
  });

  // covers lines 49-50: getBestNext() ?? null branch — id not in graph
  it('getBestNext returns null for an unknown track id', () => {
    // graph.get('ghost') = undefined → ?? [] → [].slice(0,1)[0] → undefined → null
    expect(graph.getBestNext('ghost')).toBeNull();
  });

  // covers lines 36-38 (setWeights) and 117-121 (_recomputeAll)
  it('setWeights rebuilds the graph without data loss', () => {
    graph.addTrack('a', mkSignal(128, '8A'));
    graph.addTrack('b', mkSignal(128, '9A'));
    // Harmonic-heavy profile — different from default
    graph.setWeights({
      harmonicWeight: 0.60,
      energyWeight:   0.15,
      spectralWeight: 0.10,
      phaseWeight:    0.10,
      tempoWeight:    0.05,
    });
    // Signals unchanged — size must still be 2
    expect(graph.size()).toBe(2);
    // Graph was fully rebuilt — candidates must still exist and be valid
    const best = graph.getBestNext('a');
    expect(best).not.toBeNull();
    expect(best!.score).toBeGreaterThan(0);
    expect(best!.score).toBeLessThanOrEqual(1);
    expect(best!.toTrackId).toBe('b');
  });

  // covers lines 49-50: getSignal()
  it('getSignal returns the signal for a known id', () => {
    const sig = mkSignal(128, '8A');
    graph.addTrack('a', sig);
    const returned = graph.getSignal('a');
    expect(returned).toBeDefined();
    expect(returned!.bpm).toBe(128);
    expect(returned!.key).toBe('8A');
  });

  it('getSignal returns undefined for an unknown id', () => {
    expect(graph.getSignal('ghost')).toBeUndefined();
  });

  // covers line 84: staleIdx !== -1 splice path in _recomputeOutgoing
  // This branch fires only when addTrack() is called with an already-existing id.
  it('updating an existing track updates its outgoing candidates', () => {
    graph.addTrack('a', mkSignal(128, '8A'));
    graph.addTrack('b', mkSignal(90, '1A'));   // poor BPM + key mismatch (~0.61 score)

    const before = graph.getBestNext('a');
    expect(before).not.toBeNull();
    const scoreBefore = before!.score;

    // Re-add 'b' with same id but a better signal — triggers the stale-entry splice
    graph.addTrack('b', mkSignal(128, '8A'));  // perfect BPM + key match (~0.95 score)

    const after = graph.getBestNext('a');
    expect(after).not.toBeNull();
    expect(after!.score).toBeGreaterThan(scoreBefore);
    expect(after!.toTrackId).toBe('b');
  });

  // covers line 84: !signal early-return in _recomputeOutgoing
  // _recomputeOutgoing is private; its two callers (addTrack, _recomputeAll)
  // always ensure the signal is registered first, so this guard is unreachable
  // through the public API. Invoked directly via (graph as any) to keep it covered.
  it('_recomputeOutgoing exits silently when the id has no registered signal', () => {
    graph.addTrack('a', mkSignal(128, '8A'));
    // 'ghost' is not in the signals map → signal is undefined → guard fires → return
    expect(() => (graph as any)._recomputeOutgoing('ghost')).not.toThrow();
    // State must be completely unaffected
    expect(graph.size()).toBe(1);
    expect(graph.getBestNext('a')).toBeNull();
  });
});
