/**
 * client/src/hooks/useSessionMetrics.ts
 *
 * Wraps tRPC sessionMetrics procedures.
 * Provides start/stop lifecycle + live stats for TimeSavingsPanel.
 */
import { useState, useCallback, useRef } from "react";
import { trpc }  from "@/lib/trpc";
import type { AutoLevelSessionStats } from "../../shared/auto-level.types";

const EMPTY_STATS: AutoLevelSessionStats = {
  sessionStartedAt:             Date.now(),
  totalAIAdjustments:           0,
  totalManualAdjustments:       0,
  clippingEventsPreventedCount: 0,
  acceptedSuggestions:          0,
  rejectedSuggestions:          0,
  estimatedMinutesSaved:        0,
};

export function useSessionMetrics() {
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [stats, setStats]           = useState<AutoLevelSessionStats>(EMPTY_STATS);
  const startedAtRef                = useRef<number>(Date.now());

  const startMut  = trpc.sessionMetrics.start.useMutation();
  const stopMut   = trpc.sessionMetrics.stop.useMutation();
  const totalsQ   = trpc.sessionMetrics.totals.useQuery();

  /** Call when the DAW session begins (tracks loaded, transport started). */
  const startSession = useCallback(async (trackIds: string[], bpm: number) => {
    const res = await startMut.mutateAsync({ trackIds, bpm });
    setSessionId(res.sessionId);
    startedAtRef.current = Date.now();
    setStats({ ...EMPTY_STATS, sessionStartedAt: startedAtRef.current });
    return res.sessionId;
  }, [startMut]);

  /** Call on transport stop / page unload. Returns persisted summary. */
  const stopSession = useCallback(async () => {
    if (!sessionId) return null;
    const summary = await stopMut.mutateAsync({ sessionId });
    setStats(prev => ({
      ...prev,
      estimatedMinutesSaved: Math.round(summary.timeSavedSeconds / 60),
    }));
    setSessionId(null);
    return summary;
  }, [sessionId, stopMut]);

  /** Increment counters in real-time from LLPTE events (no server round-trip). */
  const recordAIAdjustment = useCallback(() => {
    setStats(prev => ({ ...prev, totalAIAdjustments: prev.totalAIAdjustments + 1 }));
  }, []);

  const recordManualAdjustment = useCallback(() => {
    setStats(prev => ({ ...prev, totalManualAdjustments: prev.totalManualAdjustments + 1 }));
  }, []);

  const recordClippingPrevented = useCallback(() => {
    setStats(prev => ({
      ...prev,
      clippingEventsPreventedCount: prev.clippingEventsPreventedCount + 1,
    }));
  }, []);

  const recordSuggestionAccepted = useCallback(() => {
    setStats(prev => ({ ...prev, acceptedSuggestions: prev.acceptedSuggestions + 1 }));
  }, []);

  const recordSuggestionRejected = useCallback(() => {
    setStats(prev => ({ ...prev, rejectedSuggestions: prev.rejectedSuggestions + 1 }));
  }, []);

  return {
    sessionId,
    stats,
    isActive:   !!sessionId,
    totals:     totalsQ.data,
    startSession,
    stopSession,
    recordAIAdjustment,
    recordManualAdjustment,
    recordClippingPrevented,
    recordSuggestionAccepted,
    recordSuggestionRejected,
  };
}
