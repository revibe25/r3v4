/**
 * R3 v4 — SessionSummaryPanel
 * Full-screen overlay shown at session end.
 *
 * PRD §8.5 — Time Savings Tracking — display format:
 *   Session Complete
 *   42% faster than your average
 *   18 minutes saved this session
 *   AI Actions / Accepted / Auto-Applied / Manual / Clips / Transitions
 *   [Export PNG] [Export JSON] [Close]
 *
 * PRD §4 — Business Model: "Export function reliability 100% success"
 * PRD §20 — Pre-demo QA: "Export PNG generating correctly"
 *
 * Canonical location: client/components/session-summary/SessionSummaryPanel.tsx
 */

import React, { useCallback, useEffect } from 'react';
import {
  useSessionMetricsStore,
  selectShowSummary,
  selectCompletedMetrics,
  selectCompletedBreakdown,
  selectExportPngUrl,
  selectActions,
} from '../../stores/session-metrics.store';
import type { SessionMetrics, TimeSavedBreakdown } from '../../../shared/session-metrics.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatMinutes(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1_000);
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function formatPercent(ratio: number): string {
  return `${Math.round(Math.abs(ratio) * 100)}%`;
}

// ---------------------------------------------------------------------------
// StatRow
// ---------------------------------------------------------------------------
interface StatRowProps {
  label: string;
  value: string;
  accent?: boolean;
}

function StatRow({ label, value, accent = false }: StatRowProps) {
  return (
    <div className="flex items-baseline justify-between border-b border-zinc-800 py-2.5 last:border-0">
      <span className="font-sans text-sm text-zinc-400">{label}</span>
      <span
        className={`font-mono text-sm font-semibold ${
          accent ? 'text-violet-400' : 'text-zinc-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExportButtons
// ---------------------------------------------------------------------------
interface ExportButtonsProps {
  metrics:    SessionMetrics;
  breakdown:  TimeSavedBreakdown;
  pngUrl?:    string | null;
}

function ExportButtons({ metrics, breakdown, pngUrl }: ExportButtonsProps) {
  const handleExportJson = useCallback(() => {
    const payload = {
      metrics,
      breakdown,
      generatedAt: new Date().toISOString(),
      appVersion:  '4.2.1',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `r3-session-${metrics.sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [metrics, breakdown]);

  const handleExportPng = useCallback(() => {
    if (!pngUrl) return;
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `r3-session-${metrics.sessionId.slice(0, 8)}.png`;
    a.target = '_blank';
    a.click();
  }, [pngUrl, metrics.sessionId]);

  return (
    <div className="flex gap-3">
      {pngUrl && (
        <button
          onClick={handleExportPng}
          className="rounded-md bg-emerald-600 px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          aria-label="Export session summary as PNG image"
        >
          Export PNG
        </button>
      )}
      <button
        onClick={handleExportJson}
        className="rounded-md bg-zinc-700 px-4 py-2 font-sans text-sm font-semibold text-zinc-100 hover:bg-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        aria-label="Export session data as JSON"
      >
        Export JSON
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionSummaryPanel
// ---------------------------------------------------------------------------
export function SessionSummaryPanel() {
  const showPanel = useSessionMetricsStore(selectShowSummary);
  const metrics   = useSessionMetricsStore(selectCompletedMetrics);
  const breakdown = useSessionMetricsStore(selectCompletedBreakdown);
  const pngUrl    = useSessionMetricsStore(selectExportPngUrl);
  const { closeSummaryPanel } = useSessionMetricsStore(selectActions);

  // Keyboard: Escape closes the panel
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSummaryPanel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showPanel, closeSummaryPanel]);

  if (!showPanel || !metrics || !breakdown) return null;

  const pctFaster        = Math.round(Math.abs(metrics.timeSavingPercent) * 100);
  const isFaster         = metrics.timeSavingPercent > 0;
  const minutesSaved     = formatMinutes(metrics.estimatedTimeSavedMs);
  const acceptancePct    = Math.round(metrics.acceptanceRate * 100);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Session Complete — Summary"
      onClick={(e) => { if (e.target === e.currentTarget) closeSummaryPanel(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-8 shadow-2xl">
        {/* Close */}
        <button
          className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          onClick={closeSummaryPanel}
          aria-label="Close session summary"
        >
          ✕
        </button>

        {/* Header */}
        <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Session Complete
        </p>

        {/* Primary stat */}
        <div className="mb-1 flex items-baseline gap-2">
          <span className="font-mono text-5xl font-bold text-violet-400">
            {pctFaster}%
          </span>
        </div>
        <p className="mb-1 font-sans text-sm text-zinc-400">
          {isFaster ? 'faster than your average' : 'slower than your average — keep going'}
        </p>

        {/* Divider */}
        <div className="my-4 h-px bg-zinc-800" />

        {/* Minutes saved */}
        <div className="mb-4 flex items-baseline gap-1.5">
          <span
            className="font-mono text-3xl font-bold text-cyan-400"
            aria-label={`${minutesSaved} saved this session`}
          >
            {minutesSaved} saved
          </span>
          <span className="font-sans text-sm text-zinc-500">this session</span>
        </div>

        {/* Stats */}
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-1">
          <StatRow
            label="AI Actions"
            value={String(metrics.aiActionsCount)}
            accent
          />
          <StatRow
            label={`Accepted (${acceptancePct}%)`}
            value={String(metrics.aiActionsAccepted)}
          />
          <StatRow
            label="Auto-Applied"
            value={String(metrics.aiActionsAutoApplied)}
          />
          <StatRow
            label="Manual Actions"
            value={String(metrics.manualAdjustments)}
          />
          <StatRow
            label="Clips Prevented"
            value={String(metrics.clippingEventsPrevented)}
          />
          <StatRow
            label="Transitions"
            value={String(metrics.transitionsAccepted)}
          />
        </div>

        {/* Export + Close */}
        <div className="flex items-center justify-between">
          <ExportButtons metrics={metrics} breakdown={breakdown} pngUrl={pngUrl} />
          <button
            className="rounded-md px-3 py-2 font-sans text-sm text-zinc-500 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600"
            onClick={closeSummaryPanel}
            aria-label="Close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}