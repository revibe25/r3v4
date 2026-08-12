import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSessionMetricsStore } from "../../stores/session-metrics.store";
/**
 * Full session summary panel — render once at App root level.
 * Only visible after a session ends.
 */
export function SessionSummaryPanel() {
    const { summary, reset } = useSessionMetricsStore();
    if (!summary)
        return null;
    const mins = Math.floor(summary.durationSeconds / 60);
    const secs = summary.durationSeconds % 60;
    const savedMins = Math.floor(summary.timeSavedSeconds / 60);
    const savedSecs = summary.timeSavedSeconds % 60;
    return (_jsx("div", { className: "session-summary-panel", role: "dialog", "aria-label": "Session Summary", children: _jsxs("div", { className: "session-summary-panel__inner", children: [_jsx("h2", { className: "session-summary-panel__title", children: "Session Complete" }), _jsxs("div", { className: "session-summary-panel__grid", children: [_jsxs("div", { className: "session-summary-panel__stat", children: [_jsx("span", { className: "session-summary-panel__stat-label", children: "Duration" }), _jsxs("span", { className: "session-summary-panel__stat-value", children: [mins, "m ", secs.toString().padStart(2, "0"), "s"] })] }), _jsxs("div", { className: "session-summary-panel__stat", children: [_jsx("span", { className: "session-summary-panel__stat-label", children: "Time Saved" }), _jsxs("span", { className: "session-summary-panel__stat-value", children: [savedMins, "m ", savedSecs.toString().padStart(2, "0"), "s"] })] }), _jsxs("div", { className: "session-summary-panel__stat", children: [_jsx("span", { className: "session-summary-panel__stat-label", children: "BPM" }), _jsx("span", { className: "session-summary-panel__stat-value", children: summary.bpm })] }), _jsxs("div", { className: "session-summary-panel__stat", children: [_jsx("span", { className: "session-summary-panel__stat-label", children: "Mix Quality" }), _jsxs("span", { className: "session-summary-panel__stat-value", children: [(summary.mixQualityScore * 100).toFixed(0), "%"] })] })] }), _jsx("button", { className: "session-summary-panel__close", onClick: reset, "aria-label": "Dismiss session summary", children: "Dismiss" })] }) }));
}
