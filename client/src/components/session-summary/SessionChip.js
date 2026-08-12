import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSessionMetricsStore } from "../../stores/session-metrics.store";
/**
 * Compact chip for Zone 1 top nav — shows live session state.
 * Place after the BPM counter.
 */
export function SessionChip() {
    const { isActive, summary, sessionId } = useSessionMetricsStore();
    if (!isActive && !summary)
        return null;
    if (isActive) {
        return (_jsxs("div", { className: "session-chip session-chip--active", title: `Session: ${sessionId}`, children: [_jsx("span", { className: "session-chip__dot" }), _jsx("span", { className: "session-chip__label", children: "Live" })] }));
    }
    if (summary) {
        const mins = Math.floor(summary.durationSeconds / 60);
        const secs = summary.durationSeconds % 60;
        const duration = `${mins}m ${secs.toString().padStart(2, "0")}s`;
        const savedMins = Math.floor(summary.timeSavedSeconds / 60);
        return (_jsx("div", { className: "session-chip session-chip--done", title: "Session complete", children: _jsxs("span", { className: "session-chip__label", children: [duration, " \u00B7 saved ", savedMins, "m"] }) }));
    }
    return null;
}
