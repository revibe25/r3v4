/**
 * R3 v4 — SessionChip
 * Inline top-nav widget that shows live AI action count during a session.
 *
 * PRD §7  — Zone 1 (top nav, right side, after BPM counter)
 * PRD §8.5 — "AI: 34 actions — zinc-800 background, violet text.
 *              Updates every 30 seconds.
 *              Clicking opens mini session summary popover."
 *
 * Canonical location: client/components/session-summary/SessionChip.tsx
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { trpc } from '../../utils/trpc';   // adjust to your tRPC client path
import {
  useSessionMetricsStore,
  selectChipData,
  selectIsSessionActive,
  selectSessionId,
  selectActions,
} from '../../stores/session-metrics.store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// MiniPopover — shown on chip click
// ---------------------------------------------------------------------------
interface MiniPopoverProps {
  aiActionsCount: number;
  timeSavedMs:    number;
  onClose:        () => void;
}

function MiniPopover({ aiActionsCount, timeSavedMs, onClose }: MiniPopoverProps) {
  const minutesSaved = Math.round(timeSavedMs / 60_000);
  const secondsSaved = Math.round((timeSavedMs % 60_000) / 1_000);

  return (
    <div
      className="absolute top-10 right-0 z-50 w-56 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl"
      role="dialog"
      aria-label="Live session summary"
    >
      <button
        className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
        onClick={onClose}
        aria-label="Close session popover"
      >
        ✕
      </button>

      <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Live Session
      </p>

      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-bold text-violet-400">
          {aiActionsCount}
        </span>
        <span className="text-sm text-zinc-400">AI actions</span>
      </div>

      {timeSavedMs > 0 && (
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-mono text-lg font-bold text-cyan-400">
            {minutesSaved}m {secondsSaved}s
          </span>
          <span className="text-xs text-zinc-400">saved</span>
        </div>
      )}

      <p className="mt-2 text-[11px] text-zinc-600">Updates every 30s</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionChip
// ---------------------------------------------------------------------------
export function SessionChip() {
  const isActive   = useSessionMetricsStore(selectIsSessionActive);
  const sessionId  = useSessionMetricsStore(selectSessionId);
  const chipData   = useSessionMetricsStore(selectChipData);
  const { chipUpdated } = useSessionMetricsStore(selectActions);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);

  // ── tRPC polling ──────────────────────────────────────────────────────────
  const { data: liveSnapshot } = trpc.sessions.liveSummary.useQuery(
    { sessionId: sessionId ?? '' },
    {
      enabled:           isActive && sessionId !== null,
      refetchInterval:   POLL_INTERVAL_MS,
      refetchOnWindowFocus: false,
    },
  );

  // Sync polled data into the store
  useEffect(() => {
    if (!liveSnapshot) return;
    chipUpdated({
      aiActionsCount: liveSnapshot.aiActionsCount,
      timeSavedMs:    liveSnapshot.estimatedTimeSavedMs,
    });
  }, [liveSnapshot, chipUpdated]);

  // ── Close popover on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverOpen]);

  const handleToggle = useCallback(() => setPopoverOpen((v) => !v), []);

  // Hidden when no session is active
  if (!isActive || !chipData) return null;

  return (
    <div className="relative">
      <button
        ref={chipRef}
        className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1 font-mono text-xs font-semibold text-violet-400 hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        onClick={handleToggle}
        aria-label={`AI: ${chipData.aiActionsCount} actions — click to expand session summary`}
        aria-expanded={popoverOpen}
        aria-haspopup="dialog"
      >
        {/* Pulsing dot while active */}
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400"
          aria-hidden="true"
          style={{ animation: 'pulse 2s infinite' }}
        />
        AI: {chipData.aiActionsCount} actions
      </button>

      {popoverOpen && (
        <MiniPopover
          aiActionsCount={chipData.aiActionsCount}
          timeSavedMs={chipData.timeSavedMs}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  );
}