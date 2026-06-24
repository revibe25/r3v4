// ─────────────────────────────────────────────────────────────
// packages/llpte-execution/src/AutoLevelExecutor.ts
//
// Applies AutoLevelRecommendations to live Web Audio nodes.
// Conforms strictly to AutoLevelEvent / AutoLevelEventType in
// shared/auto-level.types.ts.
// ─────────────────────────────────────────────────────────────

import type {
  TrackId,
  AutoLevelRecommendation,
  AutoLevelApplyResult,
  GainAdjustment,
  EQSuggestion,
  AutoLevelEvent,
} from '@shared/auto-level.types';

// ── Audio Node Registry ──────────────────────────────────────

export interface TrackAudioNodes {
  trackId:   TrackId;
  gainNode:  GainNode;
  eqNodes?:  BiquadFilterNode[];
  context:   AudioContext;
}

// ── Event Bus ─────────────────────────────────────────────────

type AutoLevelEventListener = (event: AutoLevelEvent) => void;

class AutoLevelEventBus {
  private listeners = new Set<AutoLevelEventListener>();

  subscribe(listener: AutoLevelEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: AutoLevelEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* isolate */ }
    }
  }
}

// ── Executor Config ───────────────────────────────────────────

export interface AutoLevelExecutorConfig {
  /** Time constant for AudioParam.setTargetAtTime() — 50 ms is click-free */
  gainRampTimeConstant:  number;
  /** Skip gain changes smaller than this (avoids micro-adjustments) */
  gainChangeThresholddB: number;
}

const DEFAULT_EXECUTOR_CONFIG: AutoLevelExecutorConfig = {
  gainRampTimeConstant:  0.05,
  gainChangeThresholddB: 0.3,
};

// ── AutoLevelExecutor ─────────────────────────────────────────

export class AutoLevelExecutor {
  private readonly nodes         = new Map<TrackId, TrackAudioNodes>();
  private readonly userOverrides = new Set<TrackId>();
  private readonly config:       AutoLevelExecutorConfig;
  readonly events = new AutoLevelEventBus();

  constructor(config: Partial<AutoLevelExecutorConfig> = {}) {
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
  }

  // ── Registration ───────────────────────────────────────────

  registerTrack(nodes: TrackAudioNodes): void {
    this.nodes.set(nodes.trackId, nodes);
  }

  unregisterTrack(trackId: TrackId): void {
    this.nodes.delete(trackId);
    this.userOverrides.delete(trackId);
  }

  notifyUserOverride(trackId: TrackId, newGainLinear: number): void {
    this.userOverrides.add(trackId);
    this.events.emit({
      type:      'override_set',
      trackId,
      data:      { newGain: newGainLinear },
      timestamp: Date.now(),
    });
  }

  clearOverride(trackId: TrackId): void {
    this.userOverrides.delete(trackId);
  }

  clearAllOverrides(): void {
    this.userOverrides.clear();
  }

  // ── Apply ──────────────────────────────────────────────────

  apply(recommendation: AutoLevelRecommendation): AutoLevelApplyResult {
    const startTime        = performance.now();
    const appliedTrackIds: TrackId[] = [];
    const skippedTrackIds: TrackId[] = [];

    // ── Gain adjustments ────────────────────────────────────
    for (const adjustment of recommendation.gainAdjustments) {
      const { trackId } = adjustment;

      if (this.userOverrides.has(trackId)) {
        skippedTrackIds.push(trackId);
        continue;
      }

      const nodes = this.nodes.get(trackId);
      if (!nodes) {
        skippedTrackIds.push(trackId);
        continue;
      }

      if (Math.abs(adjustment.deltaDb) >= this.config.gainChangeThresholddB) {
        this.applyGain(nodes, adjustment);
        appliedTrackIds.push(trackId);
      }
    }

    // ── EQ suggestions grouped by track ─────────────────────
    const eqByTrack = new Map<TrackId, EQSuggestion[]>();
    for (const eq of recommendation.eqSuggestions) {
      if (!eqByTrack.has(eq.trackId)) eqByTrack.set(eq.trackId, []);
      eqByTrack.get(eq.trackId)!.push(eq);
    }
    for (const [trackId, suggestions] of eqByTrack) {
      const nodes = this.nodes.get(trackId);
      if (nodes?.eqNodes?.length) this.applyEQ(nodes, suggestions);
    }

    // ── Clipping events ──────────────────────────────────────
    for (const trackId of recommendation.clippingAlerts) {
      if (this.nodes.has(trackId)) {
        this.events.emit({
          type:      'clipping_detected',
          trackId,
          data:      { trackId },
          timestamp: Date.now(),
        });
      }
    }

    const executionTimeMs = performance.now() - startTime;

    const result: AutoLevelApplyResult = {
      frameId:         recommendation.frameId,
      appliedAt:       performance.now(),
      appliedTrackIds,
      skippedTrackIds,
      executionTimeMs,
    };

    this.events.emit({
      type:      'adjustment_applied',
      data:      result,
      timestamp: Date.now(),
    });

        // @ts-ignore
    if (process.env.NODE_ENV === 'development' && executionTimeMs > 10) {
      console.warn(`[AutoLevelExecutor] ${executionTimeMs.toFixed(2)}ms — approaching 15ms budget`);
    }

    return result;
  }

  // ── Suggestion Acceptance ──────────────────────────────────

  acceptSuggestion(trackId: TrackId): void {
    this.clearOverride(trackId);
    this.events.emit({ type: 'adjustment_accepted', trackId, data: { trackId }, timestamp: Date.now() });
  }

  rejectSuggestion(trackId: TrackId): void {
    this.userOverrides.add(trackId);
    this.events.emit({ type: 'adjustment_rejected', trackId, data: { trackId }, timestamp: Date.now() });
  }

  // ── Private Audio Application ──────────────────────────────

  private applyGain(nodes: TrackAudioNodes, adjustment: GainAdjustment): void {
    const { gainNode, context } = nodes;
    const currentGain   = gainNode.gain.value;
    const deltaLinear   = Math.pow(10, adjustment.deltaDb / 20);
    const targetGain    = Math.max(0, Math.min(4, currentGain * deltaLinear));
    gainNode.gain.setTargetAtTime(targetGain, context.currentTime, this.config.gainRampTimeConstant);
  }

  private applyEQ(nodes: TrackAudioNodes, suggestions: EQSuggestion[]): void {
    const { eqNodes, context } = nodes;
    if (!eqNodes || eqNodes.length === 0) return;
    const ct = context.currentTime;

    for (let i = 0; i < Math.min(suggestions.length, eqNodes.length); i++) {
      const s  = suggestions[i];
      const eq = eqNodes[i];
      switch (s.band) {
        case 'low':
          eq.type = 'highpass';
          eq.frequency.setTargetAtTime(s.frequency, ct, 0.1);
          eq.Q.setTargetAtTime(s.q, ct, 0.1);
          break;
        case 'low-mid':
        case 'high-mid':
          eq.type = 'peaking';
          eq.frequency.setTargetAtTime(s.frequency, ct, 0.1);
          eq.gain.setTargetAtTime(s.gain, ct, 0.1);
          eq.Q.setTargetAtTime(s.q, ct, 0.1);
          break;
        case 'high':
          eq.type = 'highshelf';
          eq.frequency.setTargetAtTime(s.frequency, ct, 0.1);
          eq.gain.setTargetAtTime(s.gain, ct, 0.1);
          break;
      }
    }
  }

  // ── Inspection ────────────────────────────────────────────

  get registeredTrackCount(): number { return this.nodes.size; }
  isOverridden(trackId: TrackId): boolean { return this.userOverrides.has(trackId); }

  dispose(): void {
    this.nodes.clear();
    this.userOverrides.clear();
  }
}
