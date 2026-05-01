// ─────────────────────────────────────────────────────────────
// packages/llpte-core/src/AutoLevelPipeline.ts
//
// The main orchestration layer for AI Auto-Leveling.
// Runs the full pipeline on each animation frame:
//
//   MixAnalyzer.captureFrame()
//       → AutoLevelEngine.analyze()
//       → AutoLevelExecutor.apply()
//       → Event emission → React UI update
//
// This is what the LLPTE Node Graph visualizes in the UI.
// ─────────────────────────────────────────────────────────────

import type { TrackAnalyzer } from '../../llpte-signal/src/analyzers/TrackAnalyzer';
import { MixAnalyzer } from '../../llpte-signal/src/analyzers/TrackAnalyzer';
import { AutoLevelEngine } from '../../llpte-ai/src/AutoLevelEngine';
import { AutoLevelExecutor } from '../../llpte-execution/src/AutoLevelExecutor';
import type {
  TrackId,
  AutoLevelRecommendation,
  AutoLevelApplyResult,
  AutoLevelSessionStats,
  AutoLevelEvent,
} from '../../../shared/auto-level.types';

export type { TrackAnalyzerConfig } from '../../llpte-signal/src/analyzers/TrackAnalyzer';
export type { TrackAudioNodes } from '../../llpte-execution/src/AutoLevelExecutor';

// ── Pipeline State ────────────────────────────────────────────

export type PipelineNodeStatus = 'idle' | 'active' | 'error';

/** Live status of each LLPTE node — drives the animated node graph UI */
export interface PipelineNodeState {
  inputRouter: PipelineNodeStatus;
  spectralAnalyzer: PipelineNodeStatus;
  aiMixEngine: PipelineNodeStatus;
  transitionGraph: PipelineNodeStatus;
  outputBus: PipelineNodeStatus;
  /** Last inference time in ms */
  lastInferenceMs: number;
  /** Frame rate of the analysis loop */
  analysisFrameRate: number;
}

export interface PipelineConfig {
  /** Target analysis framerate (default: 30fps = every ~33ms) */
  analysisHz: number;
  /** Emit recommendations even if no adjustments needed (for UI heartbeat) */
  alwaysEmit: boolean;
}

const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  analysisHz: 30,
  alwaysEmit: true,
};

// ── AutoLevelPipeline ─────────────────────────────────────────

type PipelineEventListener = (event: AutoLevelEvent) => void;
type NodeStateListener = (state: PipelineNodeState) => void;

export class AutoLevelPipeline {
  private readonly analyzer: MixAnalyzer;
  private readonly engine: AutoLevelEngine;
  private readonly executor: AutoLevelExecutor;
  private readonly config: PipelineConfig;

  private rafHandle: number | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private frameCount = 0;
  private lastFrameTime = 0;
  private measuredFPS = 0;

  /** Session statistics — persisted for Time Savings panel */
  private sessionStats: AutoLevelSessionStats = {
    sessionStartedAt: Date.now(),
    totalAIAdjustments: 0,
    totalManualAdjustments: 0,
    clippingEventsPreventedCount: 0,
    acceptedSuggestions: 0,
    rejectedSuggestions: 0,
    estimatedMinutesSaved: 0,
  };

  private nodeState: PipelineNodeState = {
    inputRouter: 'idle',
    spectralAnalyzer: 'idle',
    aiMixEngine: 'idle',
    transitionGraph: 'idle',
    outputBus: 'idle',
    lastInferenceMs: 0,
    analysisFrameRate: 0,
  };

  private readonly eventListeners = new Set<PipelineEventListener>();
  private readonly nodeStateListeners = new Set<NodeStateListener>();

  constructor(
    masterAnalyser: AnalyserNode,
    sampleRate: number,
    config: Partial<PipelineConfig> = {},
  ) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };

    this.analyzer = new MixAnalyzer({ masterAnalyser, sampleRate });
    this.engine = new AutoLevelEngine(sampleRate);
    this.executor = new AutoLevelExecutor();

    // Forward executor events to pipeline subscribers
    this.executor.events.subscribe((event) => {
      this.handleExecutorEvent(event);
      this.emitEvent(event);
    });
  }

  // ── Registration ───────────────────────────────────────────

  registerTrack(
    trackAnalyzer: TrackAnalyzer,
    gainNode: GainNode,
    context: AudioContext,
    eqNodes?: BiquadFilterNode[],
  ): void {
    this.analyzer.registerTrack(trackAnalyzer);
    this.executor.registerTrack({
      trackId: trackAnalyzer.id,
      gainNode,
      context,
      eqNodes,
    });
  }

  unregisterTrack(trackId: TrackId): void {
    this.analyzer.unregisterTrack(trackId);
    this.executor.unregisterTrack(trackId);
    this.engine.reset();
  }

  // ── Control ────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.sessionStats.sessionStartedAt = Date.now();
    this.scheduleNextFrame();
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.updateNodeState({
      inputRouter: 'idle',
      spectralAnalyzer: 'idle',
      aiMixEngine: 'idle',
      transitionGraph: 'idle',
      outputBus: 'idle',
    });
  }

  // ── User Override Passthrough ──────────────────────────────

  notifyUserFaderMove(trackId: TrackId, newGainLinear: number): void {
    this.executor.notifyUserOverride(trackId, newGainLinear);
    this.sessionStats.totalManualAdjustments++;
    // Estimate time cost: each manual adjustment ~8 seconds of manual work
    this.recalculateTimeSavings();
  }

  acceptSuggestion(trackId: TrackId): void {
    this.executor.acceptSuggestion(trackId);
    this.sessionStats.acceptedSuggestions++;
    this.recalculateTimeSavings();
  }

  rejectSuggestion(trackId: TrackId): void {
    this.executor.rejectSuggestion(trackId);
    this.sessionStats.rejectedSuggestions++;
  }

  // ── Events ────────────────────────────────────────────────

  subscribe(listener: PipelineEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  subscribeNodeState(listener: NodeStateListener): () => void {
    this.nodeStateListeners.add(listener);
    // Immediately emit current state
    listener(this.nodeState);
    return () => this.nodeStateListeners.delete(listener);
  }

  // ── Getters ────────────────────────────────────────────────

  get stats(): Readonly<AutoLevelSessionStats> {
    return { ...this.sessionStats };
  }

  get currentNodeState(): Readonly<PipelineNodeState> {
    return { ...this.nodeState };
  }

  get running(): boolean {
    return this.isRunning;
  }

  // ── Private Pipeline Loop ──────────────────────────────────

  private scheduleNextFrame(): void {
    if (!this.isRunning) return;

    const targetInterval = 1000 / this.config.analysisHz;

    // Use setInterval for consistent non-visual timing (more reliable than rAF for audio)
    if (this.intervalHandle === null) {
      this.intervalHandle = setInterval(() => {
        if (this.isRunning) {
          this.runFrame();
        }
      }, targetInterval);
    }
  }

  private runFrame(): void {
    const frameStart = performance.now();

    try {
      // ── Node: Input Router ──────────────────────────────────
      this.updateNodeState({ inputRouter: 'active' });

      // ── Node: Spectral Analyzer ─────────────────────────────
      this.updateNodeState({ spectralAnalyzer: 'active' });
      const snapshot = this.analyzer.captureFrame();

      // ── Node: AI Mix Engine ─────────────────────────────────
      this.updateNodeState({ aiMixEngine: 'active' });
      const recommendation = this.engine.analyze(snapshot);

      // ── Node: Transition Graph (passthrough for auto-level) ──
      this.updateNodeState({ transitionGraph: 'active' });

      // ── Node: Output Bus ────────────────────────────────────
      this.updateNodeState({ outputBus: 'active' });
      const applyResult = this.executor.apply(recommendation);

      // Update stats
      this.sessionStats.totalAIAdjustments += applyResult.appliedTrackIds.length;
      this.sessionStats.clippingEventsPreventedCount += recommendation.clippingAlerts.length;
      this.recalculateTimeSavings();

      // Measure FPS
      this.frameCount++;
      const now = performance.now();
      if (this.lastFrameTime > 0) {
        const dt = now - this.lastFrameTime;
        this.measuredFPS = 0.9 * this.measuredFPS + 0.1 * (1000 / dt);
      }
      this.lastFrameTime = now;

      // Emit recommendation event for UI
      if (this.config.alwaysEmit || recommendation.gainAdjustments.length > 0) {
        this.emitEvent({ type: 'recommendation', data: recommendation, timestamp: Date.now() });
      }

      // Update node state with timing
      this.updateNodeState({
        inputRouter: 'idle',
        spectralAnalyzer: 'idle',
        aiMixEngine: 'idle',
        transitionGraph: 'idle',
        outputBus: 'idle',
        lastInferenceMs: recommendation.processingTimeMs,
        analysisFrameRate: Math.round(this.measuredFPS),
      });

    } catch (error) {
      console.error('[AutoLevelPipeline] Frame error:', error);
      this.updateNodeState({
        inputRouter: 'error',
        spectralAnalyzer: 'error',
        aiMixEngine: 'error',
        transitionGraph: 'error',
        outputBus: 'error',
      });
    }
  }

  private handleExecutorEvent(event: AutoLevelEvent): void {
    if (event.type === 'clipping_detected') {
      this.sessionStats.clippingEventsPreventedCount++;
    }
  }

  private recalculateTimeSavings(): void {
    // Heuristic: each AI adjustment saves ~8 seconds vs manual
    // Each accepted suggestion saves ~15 seconds
    const aiSavings = this.sessionStats.totalAIAdjustments * (8 / 60);
    const acceptedSavings = this.sessionStats.acceptedSuggestions * (15 / 60);
    this.sessionStats.estimatedMinutesSaved = Math.round(aiSavings + acceptedSavings);
  }

  private emitEvent(event: AutoLevelEvent): void {
    for (const listener of this.eventListeners) {
      try { listener(event); } catch { /* isolate */ }
    }
  }

  private updateNodeState(partial: Partial<PipelineNodeState>): void {
    this.nodeState = { ...this.nodeState, ...partial };
    for (const listener of this.nodeStateListeners) {
      try { listener(this.nodeState); } catch { /* isolate */ }
    }
  }

  dispose(): void {
    this.stop();
    this.analyzer.dispose();
    this.executor.dispose();
    this.eventListeners.clear();
    this.nodeStateListeners.clear();
  }
}
