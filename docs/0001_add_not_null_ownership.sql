-- Migration: 0001_add_not_null_ownership.sql
-- Generated: 2026-04-22
-- Addresses: F-05 (Mythos audit) — missing NOT NULL on projects.user_id and sessions.user_id
--
-- PREREQUISITES: Deploy this migration BEFORE deploying the updated schema.ts.
-- The schema change adds .notNull() to both columns; the DB must reflect this
-- before the application boots or Drizzle will reject the schema check.
--
-- SAFETY: The DELETE statements below remove orphaned rows with null user_id.
-- In production these should not exist (the router always sets userId), but
-- the migration must be safe to run on any state of the DB.
-- Review the counts first if you want to confirm before deletion:
--   SELECT COUNT(*) FROM projects WHERE user_id IS NULL;
--   SELECT COUNT(*) FROM sessions WHERE user_id IS NULL;

BEGIN;

-- Step 1: Remove any orphaned rows (null user_id — unreachable via any router)
DELETE FROM projects WHERE user_id IS NULL;
DELETE FROM sessions WHERE user_id IS NULL;

-- Step 2: Add NOT NULL constraints
ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;

COMMIT;
