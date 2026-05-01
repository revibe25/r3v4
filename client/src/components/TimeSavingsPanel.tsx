// ─────────────────────────────────────────────────────────────
// client/src/components/mixer/TimeSavingsPanel.tsx
//
// Session statistics panel — critical investor demo feature.
// Shows real-time efficiency gains as the AI works.
//
// Displays:
//   - "You mixed X% faster" headline metric
//   - AI vs Manual adjustment breakdown
//   - Clipping events prevented
//   - Suggestion accept rate
//   - Animated counters for live demo
// ─────────────────────────────────────────────────────────────

import React, { memo, useMemo } from 'react';
import type { AutoLevelSessionStats } from '../../../shared/auto-level.types';

interface TimeSavingsPanelProps {
  stats: AutoLevelSessionStats;
  /** Show expanded view (for dedicated panel) vs compact inline version */
  expanded?: boolean;
}

export const _TimeSavingsPanel = memo(function TimeSavingsPanel({
  stats,
  expanded = false,
}: TimeSavingsPanelProps) {
  const _totalAdjustments = stats.totalAIAdjustments + stats.totalManualAdjustments;
  const _aiPercent = totalAdjustments > 0
    ? Math.round((stats.totalAIAdjustments / totalAdjustments) * 100)
    : 0;

  const _acceptRate = (stats.acceptedSuggestions + stats.rejectedSuggestions) > 0
    ? Math.round((stats.acceptedSuggestions / (stats.acceptedSuggestions + stats.rejectedSuggestions)) * 100)
    : 0;

  // Headline: time saved as a percentage of session time
  const _sessionMinutes = (Date.now() - stats.sessionStartedAt) / 60000;
  const _speedupPercent = sessionMinutes > 0
    ? Math.min(95, Math.round((stats.estimatedMinutesSaved / (sessionMinutes + stats.estimatedMinutesSaved)) * 100))
    : 0;

  if (!expanded) {
    // Compact inline version for mixer strip
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-background/40 border border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-500">AI SAVES</span>
          <span className="text-sm font-bold text-violet-400 font-mono">
            {stats.estimatedMinutesSaved}m
          </span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-500">CLIPS STOPPED</span>
          <span className="text-sm font-bold text-accent font-mono">
            {stats.clippingEventsPreventedCount}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl bg-background/60 border border-white/10">
      {/* Headline metric */}
      <div className="text-center">
        <div className="text-[11px] font-mono text-slate-500 uppercase tracking-widest mb-1">
          This session
        </div>
        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
          {speedupPercent}% faster
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          ~{stats.estimatedMinutesSaved} minutes saved
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="AI Adjustments"
          value={stats.totalAIAdjustments}
          subtext={`${aiPercent}% of all changes`}
          color="violet"
        />
        <StatCard
          label="Clips Prevented"
          value={stats.clippingEventsPreventedCount}
          subtext="Auto-leveling"
          color="green"
        />
        <StatCard
          label="Accept Rate"
          value={`${acceptRate}%`}
          subtext={`${stats.acceptedSuggestions} of ${stats.acceptedSuggestions + stats.rejectedSuggestions} suggestions`}
          color="blue"
        />
        <StatCard
          label="Manual Moves"
          value={stats.totalManualAdjustments}
          subtext="Your hands on deck"
          color="slate"
        />
      </div>

      {/* AI vs Manual bar */}
      {totalAdjustments > 0 && (
        <div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1.5">
            <span>AI</span>
            <span>Manual</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-700"
              style={{ width: `${aiPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono mt-1">
            <span className="text-violet-400">{stats.totalAIAdjustments} AI</span>
            <span className="text-slate-500">{stats.totalManualAdjustments} manual</span>
          </div>
        </div>
      )}

      {/* Export prompt for social proof */}
      <button className="w-full py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 rounded-lg transition-colors">
        Export Session Report
      </button>
    </div>
  );
});

// ── Stat Card ──────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  subtext: string;
  color: 'violet' | 'green' | 'blue' | 'slate';
}

const COLOR_MAP = {
  violet: 'text-violet-400',
  green: 'text-accent',
  blue: 'text-blue-400',
  slate: 'text-slate-400',
};

const _StatCard = memo(function StatCard({ label, value, subtext, color }: StatCardProps) {
  return (
    <div className="flex flex-col gap-0.5 p-2.5 rounded-lg bg-white/3 border border-white/5">
      <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-black font-mono ${COLOR_MAP[color]}`}>
        {value}
      </span>
      <span className="text-[9px] text-slate-600">{subtext}</span>
    </div>
  );
});
