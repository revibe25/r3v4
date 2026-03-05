/**
 * @llpte/llpte-transition-graph — LLPTETransitionGraph
 *
 * Maintains the full transition graph across all loaded tracks.
 * Edges are scored lazily and cached — only recomputed for affected nodes.
 *
 * Design goals:
 *   - O(1) best-next-track lookup (graph.getBestNext)
 *   - O(n) edge recomputation on track add (only from new node to all others)
 *   - Fully serializable state
 *   - Weight profile hot-swap without full recompute
 */

import type {
  TrackSignal,
  TransitionGraph,
  TransitionCandidate,
  TransitionWeights,
} from './types';
import { rankTransitions, DEFAULT_WEIGHTS } from './scoreModel';

export class LLPTETransitionGraph {
  private signals  = new Map<string, TrackSignal>();
  private graph:   TransitionGraph = new Map();
  private weights: TransitionWeights;

  constructor(weights: TransitionWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  // ── Mutations ───────────────────────────────────────────────────────────────

  /** Add or update a track. Recomputes outgoing edges from this track only. */
  addTrack(id: string, signal: TrackSignal): void {
    this.signals.set(id, signal);
    this._recomputeOutgoing(id);
  }

  /** Remove a track and all edges to/from it. */
  removeTrack(id: string): void {
    this.signals.delete(id);
    this.graph.delete(id);
    for (const [fromId, candidates] of this.graph.entries()) {
      this.graph.set(fromId, candidates.filter(c => c.toTrackId !== id));
    }
  }

  /** Hot-swap weight profile and recompute all edges. */
  setWeights(weights: TransitionWeights): void {
    this.weights = weights;
    this._recomputeAll();
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  /** Get top N ranked transitions from a track. O(1) lookup. */
  getBestTransitions(fromId: string, limit = 5): TransitionCandidate[] {
    return (this.graph.get(fromId) ?? []).slice(0, limit);
  }

  /** Get single best next track. Returns null if no candidates. */
  getBestNext(fromId: string): TransitionCandidate | null {
    return this.getBestTransitions(fromId, 1)[0] ?? null;
  }

  /** Get the signal for a loaded track. */
  getSignal(id: string): TrackSignal | undefined {
    return this.signals.get(id);
  }

  /** Number of tracks currently loaded in graph. */
  size(): number {
    return this.signals.size;
  }

  /** All track IDs currently in graph. */
  trackIds(): string[] {
    return Array.from(this.signals.keys());
  }

  // ── Serialization ────────────────────────────────────────────────────────────

  /** Export full graph state for persistence or debugging. */
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

  /** Restore from serialized state. */
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

  // ── Private ──────────────────────────────────────────────────────────────────

  private _recomputeOutgoing(id: string): void {
    const signal = this.signals.get(id);
    if (!signal) return;
    const others = Array.from(this.signals.entries())
      .filter(([k]) => k !== id)
      .map(([k, v]) => ({ id: k, signal: v }));
    this.graph.set(id, rankTransitions(signal, id, others, this.weights));
  }

  private _recomputeAll(): void {
    for (const id of this.signals.keys()) {
      this._recomputeOutgoing(id);
    }
  }
}
