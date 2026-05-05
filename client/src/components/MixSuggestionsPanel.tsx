/**
 * client/src/components/MixSuggestionsPanel.tsx
 *
 * Displays LLPTE mix suggestions with accept/reject UI.
 * Acid-techno aesthetic — ag-acid accent (#a3e635), black substrate.
 * Investor demo feature: accept rate tracked → PRD gate ≥65%.
 */
import React, { memo } from "react";
import type { MixSuggestion, SuggestionStatus } from "../hooks/useMixSuggestions";

const TYPE_LABELS: Record<MixSuggestion["type"], string> = {
  mix:         "MIX",
  arrangement: "ARRANGE",
  mastering:   "MASTER",
  harmony:     "HARMONY",
  rhythm:      "RHYTHM",
};

const TYPE_COLORS: Record<MixSuggestion["type"], string> = {
  mix:         "text-[#a3e635] border-[#a3e635]/30",
  arrangement: "text-blue-400 border-blue-400/30",
  mastering:   "text-orange-400 border-orange-400/30",
  harmony:     "text-purple-400 border-purple-400/30",
  rhythm:      "text-cyan-400 border-cyan-400/30",
};

interface Props {
  suggestions:  MixSuggestion[];
  status:       SuggestionStatus;
  acceptedIds:  Set<number>;
  rejectedIds:  Set<number>;
  acceptRate:   number;
  onAccept:     (idx: number) => void;
  onReject:     (idx: number) => void;
  onAnalyse:    () => void;
}

export const MixSuggestionsPanel = memo(function MixSuggestionsPanel({
  suggestions,
  status,
  acceptedIds,
  rejectedIds,
  acceptRate,
  onAccept,
  onReject,
  onAnalyse,
}: Props) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-background border border-white/10 min-w-[320px]">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">
            LLPTE Mix Intelligence
          </span>
          {status === "done" && suggestions.length > 0 && (
            <span className="text-[9px] font-mono text-[#a3e635] border border-[#a3e635]/30 px-1.5 py-0.5 rounded">
              {acceptRate}% accepted
            </span>
          )}
        </div>
        <button
          onClick={onAnalyse}
          disabled={status === "loading" || status === "tier_locked"}
          className="text-[10px] font-mono font-semibold px-3 py-1 rounded
            bg-[#a3e635]/10 text-[#a3e635] border border-[#a3e635]/30
            hover:bg-[#a3e635]/20 disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors"
        >
          {status === "loading" ? "ANALYSING…" : "ANALYSE"}
        </button>
      </div>

      {/* States */}
      {status === "idle" && (
        <p className="text-[11px] text-slate-600 text-center py-4">
          Hit ANALYSE to run LLPTE signal analysis on your current mix.
        </p>
      )}

      {status === "loading" && (
        <div className="flex flex-col items-center gap-2 py-6">
          <div className="w-6 h-6 border-2 border-[#a3e635]/40 border-t-[#a3e635] rounded-full animate-spin" />
          <span className="text-[10px] font-mono text-slate-500">Running LLPTE pipeline…</span>
        </div>
      )}

      {status === "tier_locked" && (
        <div className="text-center py-4 px-2">
          <p className="text-[11px] text-orange-400 font-mono mb-1">CREATOR TIER REQUIRED</p>
          <p className="text-[10px] text-slate-600">Upgrade to unlock LLPTE mix suggestions.</p>
        </div>
      )}

      {status === "error" && (
        <p className="text-[11px] text-red-400 font-mono text-center py-4">
          Analysis failed — check console.
        </p>
      )}

      {/* Suggestions list */}
      {status === "done" && suggestions.length === 0 && (
        <p className="text-[11px] text-slate-600 text-center py-4">
          Mix looks balanced — no adjustments needed.
        </p>
      )}

      {status === "done" && suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          {suggestions.map((s, idx) => {
            const accepted = acceptedIds.has(idx);
            const rejected = rejectedIds.has(idx);
            return (
              <div
                key={idx}
                className={`flex flex-col gap-2 p-3 rounded-lg border transition-all
                  ${accepted ? "bg-[#a3e635]/5 border-[#a3e635]/20" : ""}
                  ${rejected ? "bg-white/2 border-white/5 opacity-50" : ""}
                  ${!accepted && !rejected ? "bg-white/3 border-white/8" : ""}
                `}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono font-bold border px-1.5 py-0.5 rounded ${TYPE_COLORS[s.type]}`}>
                      {TYPE_LABELS[s.type]}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">
                      {Math.round(s.confidence * 100)}% confidence
                    </span>
                  </div>
                  {!accepted && !rejected && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => onAccept(idx)}
                        className="text-[9px] font-mono px-2 py-0.5 rounded
                          text-[#a3e635] border border-[#a3e635]/30
                          hover:bg-[#a3e635]/10 transition-colors"
                      >✓</button>
                      <button
                        onClick={() => onReject(idx)}
                        className="text-[9px] font-mono px-2 py-0.5 rounded
                          text-slate-500 border border-white/10
                          hover:bg-white/5 transition-colors"
                      >✕</button>
                    </div>
                  )}
                  {accepted && (
                    <span className="text-[9px] font-mono text-[#a3e635]">✓ applied</span>
                  )}
                  {rejected && (
                    <span className="text-[9px] font-mono text-slate-600">✕ skipped</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* PRD gate metric */}
      {status === "done" && suggestions.length > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-white/5">
          <span className="text-[9px] font-mono text-slate-600">ACCEPT RATE TARGET</span>
          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#a3e635] transition-all duration-500"
              style={{ width: `${acceptRate}%` }}
            />
          </div>
          <span className={`text-[9px] font-mono ${acceptRate >= 65 ? "text-[#a3e635]" : "text-slate-500"}`}>
            {acceptRate}% / 65%
          </span>
        </div>
      )}
    </div>
  );
});
