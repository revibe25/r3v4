-- Migration: 0002_c03_ai_transition_daily_window.sql
-- Mythos audit 2026-04-22 — C-03 remediation
-- Generated: 2026-05-28
--
-- Replaces per-session AI transition tracking with a per-user daily window.
-- The old (userId, sessionId) key was bypassable by rotating the X-Session-Id
-- header. The new (userId, usage_date) composite PK is fully server-controlled.

BEGIN;

-- 1. Drop old table (data is rate-limit counters only — no user data lost)
DROP TABLE IF EXISTS ai_transition_usage;

-- 2. Create replacement with (user_id, usage_date) composite PK
CREATE TABLE ai_transition_usage (
  user_id          VARCHAR   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date       TEXT      NOT NULL,   -- ISO date "YYYY-MM-DD" UTC
  transition_count INTEGER   NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX ai_transition_usage_user_idx ON ai_transition_usage (user_id);

-- 3. Comment
COMMENT ON TABLE ai_transition_usage IS
  'Per-user daily AI transition counter. Key is (user_id, usage_date UTC). '
  'C-03 fix: removed session_id from PK — was client-controllable via X-Session-Id header.';

COMMIT;
