// ─────────────────────────────────────────────────────────────
// client/src/hooks/useAutoLeveling.ts
//
// React hook that wraps AutoLevelPipeline and exposes a clean
// API for the MixerWithAI / AILevelAssist components.
//
// aiDecisionLog wiring (PRD §15 demo gate):
//   - accept(trackId) → write row with outcome "accepted"
//   - reject(trackId) → write row with outcome "rejected"
//   - Auto-apply (≥0.65 confidence) is NOT yet logged here — requires
//     AutoLevelPipeline event-shape changes (P1 follow-up).
// All writes guarded by sessionId from useSessionMetricsStore.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  TrackId,
  TrackAILevelState,
  AutoLevelSessionStats,
  AutoLevelRecommendation,
  AutoLevelEvent,
} from '../../../shared/auto-level.types';
import type { PipelineNodeState } from '../../../packages/llpte-core/src/AutoLevelPipeline';
import { AutoLevelPipeline } from '../../../packages/llpte-core/src/AutoLevelPipeline';
import { TrackAnalyzer } from '../../../packages/llpte-signal/src/analyzers/TrackAnalyzer';
import { trpc } from '@/lib/trpc';
import { useSessionMetricsStore } from '../stores/session-metrics.store';

// ── Public types ───────────────────────────────────────────────

export interface TrackAudioRef {
  trackId:      string;
  analyserNode: AnalyserNode;
  gainNode:     GainNode;
  eqNodes?:     BiquadFilterNode[];
}

interface UseAutoLevelingOptions {
  autoStart?:  boolean;
  analysisHz?: number;
}

interface UseAutoLevelingResult {
  enabled:             boolean;
  toggle:              () => void;
  trackStates:         Map<TrackId, TrackAILevelState>;
  accept:              (trackId: TrackId) => void;
  reject:              (trackId: TrackId) => void;
  notifyFaderMove:     (trackId: TrackId, newGainLinear: number) => void;
  nodeState:           PipelineNodeState;
  sessionStats:        AutoLevelSessionStats;
  latestRecommendation: AutoLevelRecommendation | null;
}

const DEFAULT_NODE_STATE: PipelineNodeState = {
  inputRouter:     'idle',
  spectralAnalyzer:'idle',
  aiMixEngine:     'idle',
  transitionGraph: 'idle',
  outputBus:       'idle',
  lastInferenceMs: 0,
  analysisFrameRate: 0,
};

const DEFAULT_STATS: AutoLevelSessionStats = {
  sessionStartedAt:             Date.now(),
  totalAIAdjustments:           0,
  totalManualAdjustments:       0,
  clippingEventsPreventedCount: 0,
  acceptedSuggestions:          0,
  rejectedSuggestions:          0,
  estimatedMinutesSaved:        0,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ── Hook ───────────────────────────────────────────────────────

export function useAutoLeveling(
  audioContext:   AudioContext | null,
  masterAnalyser: AnalyserNode | null,
  trackRefs:      TrackAudioRef[],
  options:        UseAutoLevelingOptions = {},
): UseAutoLevelingResult {
  const { autoStart = false, analysisHz = 30 } = options;

  const pipelineRef = useRef<AutoLevelPipeline | null>(null);

  const [enabled,             setEnabled]             = useState(false);
  const [trackStates,         setTrackStates]         = useState<Map<TrackId, TrackAILevelState>>(new Map());
  const [nodeState,           setNodeState]           = useState<PipelineNodeState>(DEFAULT_NODE_STATE);
  const [sessionStats,        setSessionStats]        = useState<AutoLevelSessionStats>(DEFAULT_STATS);
  const [latestRecommendation,setLatestRecommendation]= useState<AutoLevelRecommendation | null>(null);

  // ── aiDecisionLog wiring ─────────────────────────────────────
  // Refs sync state into the accept/reject closures without forcing them to
  // re-create on every recommendation (which arrives at analysisHz, e.g. 30Hz).
  // Stable callbacks prevent <AILevelAssist /> from re-rendering 30 times/sec.
  const recordDecisionMut    = trpc.sessionMetrics.recordDecision.useMutation();
  const recordDecisionMutRef = useRef(recordDecisionMut);
  const latestRecRef         = useRef<AutoLevelRecommendation | null>(latestRecommendation);
  const nodeStateRef         = useRef<PipelineNodeState>(nodeState);
  recordDecisionMutRef.current = recordDecisionMut;
  useEffect(() => { latestRecRef.current = latestRecommendation; }, [latestRecommendation]);
  useEffect(() => { nodeStateRef.current = nodeState; },           [nodeState]);

  useEffect(() => {
    if (!audioContext || !masterAnalyser) return;

    const pipeline = new AutoLevelPipeline(masterAnalyser, audioContext.sampleRate, { analysisHz });
    pipelineRef.current = pipeline;

    for (const ref of trackRefs) {
      const analyzer = new TrackAnalyzer({ trackId: ref.trackId, analyserNode: ref.analyserNode });
      pipeline.registerTrack(analyzer, ref.gainNode, audioContext, ref.eqNodes);
    }

    const unsubEvents = pipeline.subscribe((event: AutoLevelEvent) => {
      if (event.type === 'recommendation') {
        const rec = event.data as AutoLevelRecommendation;
        setLatestRecommendation(rec);
        setSessionStats({ ...pipeline.stats });

        setTrackStates(prev => {
          const next = new Map(prev);
          for (const adj of rec.gainAdjustments) {
            const existing = next.get(adj.trackId);
            next.set(adj.trackId, {
              trackId:       adj.trackId,
              currentGain:   1,
              suggestedGain: Math.pow(10, adj.deltaDb / 20),
              confidence:    adj.confidence,
              isClipping:    rec.clippingAlerts.includes(adj.trackId),
              userOverride:  existing?.userOverride ?? false,
              eqSuggestions: rec.eqSuggestions.filter(eq => eq.trackId === adj.trackId),
            });
          }
          for (const trackId of rec.clippingAlerts) {
            if (!next.has(trackId)) {
              next.set(trackId, {
                trackId, currentGain: 1, suggestedGain: null,
                confidence: null, isClipping: true,
                userOverride: false, eqSuggestions: [],
              });
            }
          }
          return next;
        });
      }

      if (event.type === 'override_set' && event.trackId) {
        setTrackStates(prev => {
          const next = new Map(prev);
          const ex   = next.get(event.trackId!);
          if (ex) next.set(event.trackId!, { ...ex, userOverride: true });
          return next;
        });
      }

      if (event.type === 'adjustment_accepted' && event.trackId) {
        setTrackStates(prev => {
          const next = new Map(prev);
          const ex   = next.get(event.trackId!);
          if (ex) next.set(event.trackId!, { ...ex, userOverride: false });
          return next;
        });
      }
    });

    const unsubNodeState = pipeline.subscribeNodeState(setNodeState);

    if (autoStart) { pipeline.start(); setEnabled(true); }

    return () => {
      unsubEvents();
      unsubNodeState();
      pipeline.dispose();
      pipelineRef.current = null;
    };
  }, [audioContext, masterAnalyser]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    const p = pipelineRef.current;
    if (!p) return;
    if (p.running) { p.stop(); setEnabled(false); }
    else           { p.start(); setEnabled(true);  }
  }, []);

  const accept = useCallback((trackId: TrackId) => {
    pipelineRef.current?.acceptSuggestion(trackId);
    setSessionStats(s => ({ ...s, acceptedSuggestions: s.acceptedSuggestions + 1 }));

    // Log to aiDecisionLog if a session is active.
    // Reads sessionId via Zustand getState — no re-render dependency.
    const sessionId = useSessionMetricsStore.getState().sessionId;
    const rec       = latestRecRef.current;
    if (sessionId && rec) {
      const adj = rec.gainAdjustments.find(g => g.trackId === trackId);
      if (adj) {
        recordDecisionMutRef.current.mutate(
          {
            sessionId,
            nodeId:              'aiMixEngine',
            actionType:          'gain_adjust',
            trackId,
            inputConfidence:     clamp01(adj.confidence),
            displayedConfidence: clamp01(adj.confidence),
            decision: {
              deltaDb:       adj.deltaDb,
              confidence:    adj.confidence,
              eqSuggestions: rec.eqSuggestions.filter(eq => eq.trackId === trackId),
            },
            outcome:   'accepted',
            latencyMs: Math.max(0, Math.round(nodeStateRef.current.lastInferenceMs)),
          },
          { onError: (err: unknown) =>
            console.error('[useAutoLeveling] accept log failed:', err)
          }
        );
      }
    }
  }, []);

  const reject = useCallback((trackId: TrackId) => {
    pipelineRef.current?.rejectSuggestion(trackId);
    setSessionStats(s => ({ ...s, rejectedSuggestions: s.rejectedSuggestions + 1 }));

    const sessionId = useSessionMetricsStore.getState().sessionId;
    const rec       = latestRecRef.current;
    if (sessionId && rec) {
      const adj = rec.gainAdjustments.find(g => g.trackId === trackId);
      if (adj) {
        recordDecisionMutRef.current.mutate(
          {
            sessionId,
            nodeId:              'aiMixEngine',
            actionType:          'gain_adjust',
            trackId,
            inputConfidence:     clamp01(adj.confidence),
            displayedConfidence: clamp01(adj.confidence),
            decision: {
              deltaDb:       adj.deltaDb,
              confidence:    adj.confidence,
              eqSuggestions: rec.eqSuggestions.filter(eq => eq.trackId === trackId),
            },
            outcome:   'rejected',
            latencyMs: Math.max(0, Math.round(nodeStateRef.current.lastInferenceMs)),
          },
          { onError: (err: unknown) =>
            console.error('[useAutoLeveling] reject log failed:', err)
          }
        );
      }
    }
  }, []);

  const notifyFaderMove = useCallback((trackId: TrackId, newGainLinear: number) => {
    pipelineRef.current?.notifyUserFaderMove(trackId, newGainLinear);
    setSessionStats(s => ({ ...s, totalManualAdjustments: s.totalManualAdjustments + 1 }));
  }, []);

  return { enabled, toggle, trackStates, accept, reject, notifyFaderMove, nodeState, sessionStats, latestRecommendation };
}
