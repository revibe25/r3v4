/**
 * @llpte/llpte-transition-graph — LLPTETransitionGraph
 */

import type {
  TrackSignal,
  TransitionGraph,
  TransitionCandidate,
  TransitionWeights,
} from './types';
import { rankTransitions, scoreTransition, DEFAULT_WEIGHTS } from './scoreModel';

export class LLPTETransitionGraph {
  private signals  = new Map<string, TrackSignal>();
  private graph:   TransitionGraph = new Map();
  private weights: TransitionWeights;

  constructor(weights: TransitionWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  addTrack(id: string, signal: TrackSignal): void {
    this.signals.set(id, signal);
    this._recomputeOutgoing(id);
  }

  removeTrack(id: string): void {
    this.signals.delete(id);
    this.graph.delete(id);
    for (const [fromId, candidates] of this.graph.entries()) {
      this.graph.set(fromId, candidates.filter(c => c.toTrackId !== id));
    }
  }

  setWeights(weights: TransitionWeights): void {
    this.weights = weights;
    this._recomputeAll();
  }

  getBestTransitions(fromId: string, limit = 5): TransitionCandidate[] {
    return (this.graph.get(fromId) ?? []).slice(0, limit);
  }

  getBestNext(fromId: string): TransitionCandidate | null {
    return this.getBestTransitions(fromId, 1)[0] ?? null;
  }

  getSignal(id: string): TrackSignal | undefined {
    return this.signals.get(id);
  }

  size(): number {
    return this.signals.size;
  }

  trackIds(): string[] {
    return Array.from(this.signals.keys());
  }

  serialize(): object {
    return {
      version: '0.1.0',
      weights: this.weights,
      tracks:  Object.fromEntries(this.signals),
      edges:   Object.fromEntries(
        Array.from(this.graph.entries()).map(([k, v]) => [k, v])
      ),
    };
  }

  static deserialize(data: {
    weights?: TransitionWeights;
    tracks:   Record<string, TrackSignal>;
  }): LLPTETransitionGraph {
    const g = new LLPTETransitionGraph(data.weights);
    for (const [id, signal] of Object.entries(data.tracks)) {
      g.addTrack(id, signal);
    }
    return g;
  }

  private _recomputeOutgoing(id: string): void {
    const signal = this.signals.get(id);
    if (!signal) return;

    const others = Array.from(this.signals.entries())
      .filter(([k]) => k !== id)
      .map(([k, v]) => ({ id: k, signal: v }));

    // Recompute full outgoing list for the new/updated track
    this.graph.set(id, rankTransitions(signal, id, others, this.weights));

    // Insert new track as scored candidate into every existing track's list
    for (const [otherId, otherSignal] of this.signals.entries()) {
      if (otherId === id) continue;

      const newCandidate = scoreTransition(otherSignal, signal, otherId, id, this.weights);
      const existing = this.graph.get(otherId) ?? [];

      // Remove stale entry if track was updated
      const staleIdx = existing.findIndex(c => c.toTrackId === id);
      if (staleIdx !== -1) existing.splice(staleIdx, 1);

      // Insert at correct sorted position (descending score)
      const insertAt = existing.findIndex(c => c.score < newCandidate.score);
      if (insertAt === -1) {
        existing.push(newCandidate);
      } else {
        existing.splice(insertAt, 0, newCandidate);
      }

      this.graph.set(otherId, existing);
    }
  }

  private _recomputeAll(): void {
    this.graph.clear();
    for (const id of this.signals.keys()) {
      this._recomputeOutgoing(id);
    }
  }
}
