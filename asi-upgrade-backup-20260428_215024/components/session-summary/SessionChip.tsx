import React from "react";
import { useSessionMetricsStore } from "../../stores/session-metrics.store";

/**
 * Compact chip for Zone 1 top nav — shows live session state.
 * Place after the BPM counter.
 */
export function SessionChip() {
  const { isActive, summary, sessionId } = useSessionMetricsStore();

  if (!isActive && !summary) return null;

  if (isActive) {
    return (
      <div className="session-chip session-chip--active" title={`Session: ${sessionId}`}>
        <span className="session-chip__dot" />
        <span className="session-chip__label">Live</span>
      </div>
    );
  }

  if (summary) {
    const mins = Math.floor(summary.durationSeconds / 60);
    const secs = summary.durationSeconds % 60;
    const duration = `${mins}m ${secs.toString().padStart(2, "0")}s`;
    const savedMins = Math.floor(summary.timeSavedSeconds / 60);

    return (
      <div className="session-chip session-chip--done" title="Session complete">
        <span className="session-chip__label">
          {duration} · saved {savedMins}m
        </span>
      </div>
    );
  }

  return null;
}
