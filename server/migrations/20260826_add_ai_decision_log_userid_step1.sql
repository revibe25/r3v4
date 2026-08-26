-- 20260826_add_ai_decision_log_userid_step1.sql
-- Add the userId column to ai_decision_log as NULLABLE to allow safe backfill.
-- Run this migration first. After backfill completes, apply step2 migration to set NOT NULL.

BEGIN;
ALTER TABLE ai_decision_log
  ADD COLUMN userId text REFERENCES users(id);
COMMIT;
