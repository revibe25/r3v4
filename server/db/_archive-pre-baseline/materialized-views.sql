-- R3 v4 — Session Metrics Materialized Views
-- Run once after schema push

CREATE MATERIALIZED VIEW IF NOT EXISTS session_metrics_daily AS
SELECT
  DATE_TRUNC('day', started_at)   AS day,
  user_id,
  COUNT(*)                        AS session_count,
  AVG(duration_seconds)           AS avg_duration_seconds,
  SUM(time_saved_seconds)         AS total_time_saved_seconds,
  AVG(mix_quality_score)          AS avg_mix_quality,
  AVG(peak_energy_score)          AS avg_peak_energy
FROM session_metrics
WHERE ended_at IS NOT NULL
GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS session_metrics_daily_idx
  ON session_metrics_daily (day, user_id);

-- Refresh: call REFRESH MATERIALIZED VIEW CONCURRENTLY session_metrics_daily;
-- Schedule via pg_cron or app-level cron job.
