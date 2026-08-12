import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * client/src/components/MixSuggestionsPanel.tsx
 *
 * Displays LLPTE mix suggestions with accept/reject UI.
 * Acid-techno aesthetic — ag-acid accent (#a3e635), black substrate.
 * Investor demo feature: accept rate tracked → PRD gate ≥65%.
 */
import { memo } from "react";
const TYPE_LABELS = {
    mix: "MIX",
    arrangement: "ARRANGE",
    mastering: "MASTER",
    harmony: "HARMONY",
    rhythm: "RHYTHM",
};
const TYPE_COLORS = {
    mix: "text-[#a3e635] border-[#a3e635]/30",
    arrangement: "text-blue-400 border-blue-400/30",
    mastering: "text-orange-400 border-orange-400/30",
    harmony: "text-purple-400 border-purple-400/30",
    rhythm: "text-cyan-400 border-cyan-400/30",
};
export const MixSuggestionsPanel = memo(function MixSuggestionsPanel({ suggestions, status, acceptedIds, rejectedIds, acceptRate, onAccept, onReject, onAnalyse, }) {
    return (_jsxs("div", { className: "flex flex-col gap-3 p-4 rounded-xl bg-background border border-white/10 min-w-[320px]", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[10px] font-mono text-slate-500 tracking-widest uppercase", children: "LLPTE Mix Intelligence" }), status === "done" && suggestions.length > 0 && (_jsxs("span", { className: "text-[9px] font-mono text-[#a3e635] border border-[#a3e635]/30 px-1.5 py-0.5 rounded", children: [acceptRate, "% accepted"] }))] }), _jsx("button", { onClick: onAnalyse, disabled: status === "loading" || status === "tier_locked", className: "text-[10px] font-mono font-semibold px-3 py-1 rounded\n            bg-[#a3e635]/10 text-[#a3e635] border border-[#a3e635]/30\n            hover:bg-[#a3e635]/20 disabled:opacity-40 disabled:cursor-not-allowed\n            transition-colors", children: status === "loading" ? "ANALYSING…" : "ANALYSE" })] }), status === "idle" && (_jsx("p", { className: "text-[11px] text-slate-600 text-center py-4", children: "Hit ANALYSE to run LLPTE signal analysis on your current mix." })), status === "loading" && (_jsxs("div", { className: "flex flex-col items-center gap-2 py-6", children: [_jsx("div", { className: "w-6 h-6 border-2 border-[#a3e635]/40 border-t-[#a3e635] rounded-full animate-spin" }), _jsx("span", { className: "text-[10px] font-mono text-slate-500", children: "Running LLPTE pipeline\u2026" })] })), status === "tier_locked" && (_jsxs("div", { className: "text-center py-4 px-2", children: [_jsx("p", { className: "text-[11px] text-orange-400 font-mono mb-1", children: "CREATOR TIER REQUIRED" }), _jsx("p", { className: "text-[10px] text-slate-600", children: "Upgrade to unlock LLPTE mix suggestions." })] })), status === "error" && (_jsx("p", { className: "text-[11px] text-red-400 font-mono text-center py-4", children: "Analysis failed \u2014 check console." })), status === "done" && suggestions.length === 0 && (_jsx("p", { className: "text-[11px] text-slate-600 text-center py-4", children: "Mix looks balanced \u2014 no adjustments needed." })), status === "done" && suggestions.length > 0 && (_jsx("div", { className: "flex flex-col gap-2", children: suggestions.map((s, idx) => {
                    const accepted = acceptedIds.has(idx);
                    const rejected = rejectedIds.has(idx);
                    return (_jsxs("div", { className: `flex flex-col gap-2 p-3 rounded-lg border transition-all
                  ${accepted ? "bg-[#a3e635]/5 border-[#a3e635]/20" : ""}
                  ${rejected ? "bg-white/2 border-white/5 opacity-50" : ""}
                  ${!accepted && !rejected ? "bg-white/3 border-white/8" : ""}
                `, children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-[9px] font-mono font-bold border px-1.5 py-0.5 rounded ${TYPE_COLORS[s.type]}`, children: TYPE_LABELS[s.type] }), _jsxs("span", { className: "text-[9px] font-mono text-slate-600", children: [Math.round(s.confidence * 100), "% confidence"] })] }), !accepted && !rejected && (_jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => onAccept(idx), className: "text-[9px] font-mono px-2 py-0.5 rounded\n                          text-[#a3e635] border border-[#a3e635]/30\n                          hover:bg-[#a3e635]/10 transition-colors", children: "\u2713" }), _jsx("button", { onClick: () => onReject(idx), className: "text-[9px] font-mono px-2 py-0.5 rounded\n                          text-slate-500 border border-white/10\n                          hover:bg-white/5 transition-colors", children: "\u2715" })] })), accepted && (_jsx("span", { className: "text-[9px] font-mono text-[#a3e635]", children: "\u2713 applied" })), rejected && (_jsx("span", { className: "text-[9px] font-mono text-slate-600", children: "\u2715 skipped" }))] }), _jsx("p", { className: "text-[11px] text-slate-300 leading-relaxed", children: s.description })] }, idx));
                }) })), status === "done" && suggestions.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 pt-1 border-t border-white/5", children: [_jsx("span", { className: "text-[9px] font-mono text-slate-600", children: "ACCEPT RATE TARGET" }), _jsx("div", { className: "flex-1 h-1 rounded-full bg-white/5 overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-[#a3e635] transition-all duration-500", style: { width: `${acceptRate}%` } }) }), _jsxs("span", { className: `text-[9px] font-mono ${acceptRate >= 65 ? "text-[#a3e635]" : "text-slate-500"}`, children: [acceptRate, "% / 65%"] })] }))] }));
});
