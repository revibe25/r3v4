import React from "react";
import { useSessionMetricsStore } from "../../stores/session-metrics.store";

/**
 * Full session summary panel — render once at App root level.
 * Only visible after a session ends.
 */
export function SessionSummaryPanel() {
  const { summary, reset } = useSessionMetricsStore();

  if (!summary) return null;

  const mins = Math.floor(summary.durationSeconds / 60);
  const secs = summary.durationSeconds % 60;
  const savedMins = Math.floor(summary.timeSavedSeconds / 60);
  const savedSecs = summary.timeSavedSeconds % 60;

  return (
    <div className="session-summary-panel" role="dialog" aria-label="Session Summary">
      <div className="session-summary-panel__inner">
        <h2 className="session-summary-panel__title">Session Complete</h2>

        <div className="session-summary-panel__grid">
          <div className="session-summary-panel__stat">
            <span className="session-summary-panel__stat-label">Duration</span>
            <span className="session-summary-panel__stat-value">
              {mins}m {secs.toString().padStart(2, "0")}s
            </span>
          </div>

          <div className="session-summary-panel__stat">
            <span className="session-summary-panel__stat-label">Time Saved</span>
            <span className="session-summary-panel__stat-value">
              {savedMins}m {savedSecs.toString().padStart(2, "0")}s
            </span>
          </div>

          <div className="session-summary-panel__stat">
            <span className="session-summary-panel__stat-label">BPM</span>
            <span className="session-summary-panel__stat-value">{summary.bpm}</span>
          </div>

          <div className="session-summary-panel__stat">
            <span className="session-summary-panel__stat-label">Mix Quality</span>
            <span className="session-summary-panel__stat-value">
              {(summary.mixQualityScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <button
          className="session-summary-panel__close"
          onClick={reset}
          aria-label="Dismiss session summary"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
