import { describe, it, expect, beforeEach } from 'vitest';
import { LLPTETransitionGraph } from '../src/transitionGraph';
import type { TrackSignal } from '../src/types';

const mkSignal = (bpm: number, key: string): TrackSignal => ({
  bpm, key, energy: 0.7, spectralCentroid: 3000, rmsLoudness: 0.6,
});

describe('LLPTETransitionGraph', () => {
  let graph: LLPTETransitionGraph;

  beforeEach(() => { graph = new LLPTETransitionGraph(); });

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
});
