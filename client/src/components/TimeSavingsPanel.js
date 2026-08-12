import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { memo } from 'react';
export const TimeSavingsPanel = memo(function TimeSavingsPanel({ stats, expanded = false, }) {
    const totalAdjustments = stats.totalAIAdjustments + stats.totalManualAdjustments;
    const aiPercent = totalAdjustments > 0
        ? Math.round((stats.totalAIAdjustments / totalAdjustments) * 100)
        : 0;
    const acceptRate = (stats.acceptedSuggestions + stats.rejectedSuggestions) > 0
        ? Math.round((stats.acceptedSuggestions / (stats.acceptedSuggestions + stats.rejectedSuggestions)) * 100)
        : 0;
    // Headline: time saved as a percentage of session time
    const sessionMinutes = (Date.now() - stats.sessionStartedAt) / 60000;
    const speedupPercent = sessionMinutes > 0
        ? Math.min(95, Math.round((stats.estimatedMinutesSaved / (sessionMinutes + stats.estimatedMinutesSaved)) * 100))
        : 0;
    if (!expanded) {
        // Compact inline version for mixer strip
        return (_jsxs("div", { className: "flex items-center gap-3 px-3 py-1.5 rounded-lg bg-background/40 border border-white/5", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-[10px] font-mono text-slate-500", children: "AI SAVES" }), _jsxs("span", { className: "text-sm font-bold text-violet-400 font-mono", children: [stats.estimatedMinutesSaved, "m"] })] }), _jsx("div", { className: "w-px h-4 bg-white/10" }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-[10px] font-mono text-slate-500", children: "CLIPS STOPPED" }), _jsx("span", { className: "text-sm font-bold text-accent font-mono", children: stats.clippingEventsPreventedCount })] })] }));
    }
    return (_jsxs("div", { className: "flex flex-col gap-4 p-4 rounded-xl bg-background/60 border border-white/10", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-[11px] font-mono text-slate-500 uppercase tracking-widest mb-1", children: "This session" }), _jsxs("div", { className: "text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400", children: [speedupPercent, "% faster"] }), _jsxs("div", { className: "text-[11px] text-slate-500 mt-1", children: ["~", stats.estimatedMinutesSaved, " minutes saved"] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(StatCard, { label: "AI Adjustments", value: stats.totalAIAdjustments, subtext: `${aiPercent}% of all changes`, color: "violet" }), _jsx(StatCard, { label: "Clips Prevented", value: stats.clippingEventsPreventedCount, subtext: "Auto-leveling", color: "green" }), _jsx(StatCard, { label: "Accept Rate", value: `${acceptRate}%`, subtext: `${stats.acceptedSuggestions} of ${stats.acceptedSuggestions + stats.rejectedSuggestions} suggestions`, color: "blue" }), _jsx(StatCard, { label: "Manual Moves", value: stats.totalManualAdjustments, subtext: "Your hands on deck", color: "slate" })] }), totalAdjustments > 0 && (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-[10px] font-mono text-slate-500 mb-1.5", children: [_jsx("span", { children: "AI" }), _jsx("span", { children: "Manual" })] }), _jsx("div", { className: "h-2 rounded-full bg-white/5 overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-700", style: { width: `${aiPercent}%` } }) }), _jsxs("div", { className: "flex justify-between text-[10px] font-mono mt-1", children: [_jsxs("span", { className: "text-violet-400", children: [stats.totalAIAdjustments, " AI"] }), _jsxs("span", { className: "text-slate-500", children: [stats.totalManualAdjustments, " manual"] })] })] })), _jsx("button", { className: "w-full py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-200 border border-white/10 hover:border-white/20 rounded-lg transition-colors", children: "Export Session Report" })] }));
});
const COLOR_MAP = {
    violet: 'text-violet-400',
    green: 'text-accent',
    blue: 'text-blue-400',
    slate: 'text-slate-400',
};
const StatCard = memo(function StatCard({ label, value, subtext, color }) {
    return (_jsxs("div", { className: "flex flex-col gap-0.5 p-2.5 rounded-lg bg-white/3 border border-white/5", children: [_jsx("span", { className: "text-[9px] font-mono text-slate-600 uppercase tracking-wider", children: label }), _jsx("span", { className: `text-2xl font-black font-mono ${COLOR_MAP[color]}`, children: value }), _jsx("span", { className: "text-[9px] text-slate-600", children: subtext })] }));
});
