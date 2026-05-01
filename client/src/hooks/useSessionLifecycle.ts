import { useCallback } from "react";
import { trpc } from "../utils/trpc";
import { useSessionMetricsStore } from "../stores/session-metrics.store";

interface UseSessionLifecycleOptions {
  trackIds: string[];
  bpm: number;
}

/**
 * Wires play/stop transport actions to the session metrics tRPC layer.
 * Attach onPlay to your play button and onStop to your stop button.
 */
export function useSessionLifecycle({ trackIds, bpm }: UseSessionLifecycleOptions) {
  const { setSessionId, setActive, setSummary, sessionId } =
    useSessionMetricsStore();

  const _startMutation = trpc.sessions.start.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setActive(true);
    },
    onError: (err) => {
      console.error("[SessionLifecycle] start failed:", err.message);
    },
  });

  const _stopMutation = trpc.sessions.stop.useMutation({
    onSuccess: (data) => {
      setSummary(data);
      setActive(false);
    },
    onError: (err) => {
      console.error("[SessionLifecycle] stop failed:", err.message);
    },
  });

  const _onPlay = useCallback(() => {
    if (trackIds.length === 0) {
      console.warn("[SessionLifecycle] onPlay called with no tracks — skipping");
      return;
    }
    startMutation.mutate({ trackIds, bpm });
  }, [trackIds, bpm, startMutation]);

  const _onStop = useCallback(() => {
    if (!sessionId) {
      console.warn("[SessionLifecycle] onStop called but no active sessionId — skipping");
      return;
    }
    stopMutation.mutate({ sessionId });
  }, [sessionId, stopMutation]);

  return { onPlay, onStop };
}
