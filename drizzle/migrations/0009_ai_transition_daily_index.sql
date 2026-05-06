-- 0009_ai_transition_daily_index.sql
-- C-03: add (user_id, used_at) index to support the daily-scoped rate-limit query.
-- The old (user_id, session_id) index is kept for historical analytics queries.
CREATE INDEX IF NOT EXISTS idx_ai_transition_usage_user_day
  ON ai_transition_usage (user_id, used_at);
