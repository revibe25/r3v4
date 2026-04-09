/**
 * drizzle/migrations/0002_daw_project_state.sql
 *
 * Adds the `state` (JSON blob) and `deletedAt` (soft-delete) columns
 * to the `projects` table required by server/routers/daw.ts.
 *
 * Run with:
 *   pnpm drizzle-kit migrate
 *
 * The migration is idempotent — columns are added only if they do not exist.
 */

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS state      TEXT        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ          DEFAULT NULL;

-- Index for efficient soft-delete filtering
CREATE INDEX IF NOT EXISTS idx_projects_user_not_deleted
  ON projects (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- Index for room-stats route (collab)
CREATE INDEX IF NOT EXISTS idx_projects_user_id
  ON projects (user_id);