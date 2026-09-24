-- Migration 0006 — Materialized views for Time Savings baseline + confidence calibration
-- mv_user_session_averages  : per-user aggregate from session_metrics
-- mv_ai_acceptance_rates    : per-session acceptance stats from ai_decision_log
--
-- Both are created WITH NO DATA and must be refreshed after applying.
-- Refresh command: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_session_averages;
--                  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ai_acceptance_rates;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_session_averages AS
SELECT
  user_id,
  COUNT(*)                          AS total_sessions,
  ROUND(AVG(duration_seconds), 1)   AS avg_duration_seconds,
  ROUND(AVG(time_saved_seconds), 1) AS avg_time_saved_seconds,
  SUM(time_saved_seconds)           AS total_time_saved_seconds,
  ROUND(AVG(peak_energy_score)::numeric, 3) AS avg_peak_energy_score,
  ROUND(AVG(mix_quality_score)::numeric, 3) AS avg_mix_quality_score
FROM session_metrics
GROUP BY user_id
WITH NO DATA;
--> statement-breakpoint

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS mv_user_session_averages_user_id_idx
  ON mv_user_session_averages (user_id);
--> statement-breakpoint

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ai_acceptance_rates AS
SELECT
  session_id,
  COUNT(*)                                                                 AS total_decisions,
  COUNT(*) FILTER (WHERE outcome IN ('accepted', 'auto_applied'))          AS accepted_count,
  COUNT(*) FILTER (WHERE outcome = 'rejected')                             AS rejected_count,
  COUNT(*) FILTER (WHERE outcome = 'discarded')                            AS discarded_count,
  ROUND(
    COUNT(*) FILTER (WHERE outcome IN ('accepted', 'auto_applied'))::numeric
    / NULLIF(COUNT(*), 0) * 100,
  1)                                                                       AS acceptance_rate_pct,
  ROUND(AVG(input_confidence)::numeric, 3)                                 AS avg_confidence,
  ROUND(AVG(displayed_confidence)::numeric, 3)                             AS avg_displayed_confidence
FROM ai_decision_log
GROUP BY session_id
WITH NO DATA;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS mv_ai_acceptance_rates_session_id_idx
  ON mv_ai_acceptance_rates (session_id);
