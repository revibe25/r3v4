/**
 * R3 v4 — useSessionLifecycle
 * Manages the full session lifecycle: start → live tracking → end → summary.
 *
 * PRD §9 — User Flow Step 1 (transport start) → Step 6 (session end)
 * Canonical location: client/hooks/useSessionLifecycle.ts
 *
 * Contract:
 *   - Call this hook inside the Studio / djcontrols.tsx component.
 *   - Pass the current transport `isPlaying` boolean.
 *   - The hook owns session start/end side effects entirely.
 *   - All other AI action logging is done via `logAction` returned from this hook.
 *
 * Lifecycle:
 *   isPlaying true  → sessions.start mutation (idempotent if called twice)
 *   isPlaying false → sessions.end mutation → SessionSummaryPanel auto-shows
 *
 * Thread safety:
 *   - useRef guards prevent double-start under React StrictMode double-invoke.
 *   - endInProgress ref prevents double-end if stop is called twice rapidly.
 */

import { useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { trpc } from '../utils/trpc'; // adjust to your tRPC client path
import {
  useSessionMetricsStore,
  selectActions,
  selectSessionId,
  selectIsSessionActive,
} from '../stores/session-metrics.store';
import type { SessionMetricsDelta } from '../../shared/session-metrics.types';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
interface UseSessionLifecycleOptions {
  /** Current transport play state — drives start/end automatically */
  isPlaying: boolean;
}

interface UseSessionLifecycleReturn {
  /**
   * Fire-and-forget: call for every LLPTE decision emitted or user action.
   * No await required — mutation is best-effort.
   */
  logAction: (delta: SessionMetricsDelta) => void;
  /** Current sessionId (null when no session is active) */
  sessionId: string | null;
}

export function useSessionLifecycle({
  isPlaying,
}: UseSessionLifecycleOptions): UseSessionLifecycleReturn {
  const { sessionStarted, sessionEnded } = useSessionMetricsStore(selectActions);
  const sessionId      = useSessionMetricsStore(selectSessionId);
  const isSessionActive = useSessionMetricsStore(selectIsSessionActive);

  // Refs guard against double-invocation (StrictMode, rapid stop/start)
  const startInProgress = useRef(false);
  const endInProgress   = useRef(false);
  const sessionIdRef    = useRef<string | null>(null);

  // Keep ref in sync with store for use inside closures
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── tRPC mutations ─────────────────────────────────────────────────────────
  const startMutation     = trpc.sessions.start.useMutation();
  const logActionMutation = trpc.sessions.logAction.useMutation();
  const endMutation       = trpc.sessions.end.useMutation({
    onSuccess: (result) => {
      sessionEnded(result.metrics, result.breakdown, result.exportPngUrl);
    },
    onError: (err) => {
      // Non-fatal — session summary may be unavailable but product continues.
      console.error('[useSessionLifecycle] sessions.end failed:', err.message);
      endInProgress.current = false;
    },
  });

  // ── Transport start ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || isSessionActive || startInProgress.current) return;

    startInProgress.current = true;
    const newSessionId = uuidv4();

    sessionStarted(newSessionId);

    startMutation.mutate(
      { sessionId: newSessionId },
      {
        onSettled: () => { startInProgress.current = false; },
        onError: (err) => {
          console.error('[useSessionLifecycle] sessions.start failed:', err.message);
          // Session still valid locally — server will reconcile on end.
        },
      },
    );
  }, [isPlaying, isSessionActive, sessionStarted, startMutation]);

  // ── Transport stop → end session ───────────────────────────────────────────
  useEffect(() => {
    if (isPlaying || !isSessionActive || endInProgress.current) return;

    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    endInProgress.current = true;

    endMutation.mutate(
      { sessionId: currentSessionId },
      { onSettled: () => { endInProgress.current = false; } },
    );
  }, [isPlaying, isSessionActive, endMutation]);

  // ── logAction — fire-and-forget ────────────────────────────────────────────
  const logAction = useCallback(
    (delta: SessionMetricsDelta) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      logActionMutation.mutate({ sessionId: sid, ...delta });
    },
    [logActionMutation],
  );

  return { logAction, sessionId };
}