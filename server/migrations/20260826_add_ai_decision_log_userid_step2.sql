-- 20260826_add_ai_decision_log_userid_step2.sql
-- After backfill is complete, make the userId column NOT NULL and ensure FK constraint.
-- Run this migration only after you've verified the backfill and that no NULLs remain.

BEGIN;
-- Ensure there are no NULL userId values before making NOT NULL
-- Run the following check before applying this migration:
-- SELECT count(*) FROM ai_decision_log WHERE userId IS NULL;

ALTER TABLE ai_decision_log
  ALTER COLUMN userId SET NOT NULL;

-- If your DB requires an explicit constraint name, you can add a foreign key constraint:
-- ALTER TABLE ai_decision_log ADD CONSTRAINT fk_ai_decision_log_userid FOREIGN KEY (userId) REFERENCES users(id);

COMMIT;
