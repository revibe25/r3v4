# Migrations

`drizzle/migrations/` is the ONLY active migration directory.
Authority: `drizzle-kit migrate` via the repo-root `drizzle.config.ts`.

    pnpm db:generate   # after editing server/db/schema.ts
    pnpm db:migrate    # apply

Never run `drizzle-kit push` against a database with real data.

## Baseline (2026-09-23)
`0000_baseline.sql` was generated from a live schema verified byte-for-byte
against `server/db/schema.ts` via a shadow database. Prior to this, the DB had
never been managed by `migrate` — `drizzle.__drizzle_migrations` did not exist
and all schema changes arrived via `push --force`.

## Archived history (reference only — do not run)
- `drizzle/_archive-pre-baseline/`        — original root history (0000-0007)
- `server/drizzle/_archive-pre-baseline/` — a `drizzle-kit pull` dump, never a history
- `server/db/_archive-pre-baseline/`      — stale partial copy (journal had 1 of 5 files)

## Known-dead files in the archives
- `*_add_free_tier_constraint.sql` (both copies): references `projects.tier`,
  which does not exist. F-04 is instead fixed in `server/routers/daw.ts`
  via a transaction with `SELECT ... FOR UPDATE`.
- `materialized-views.sql` (`session_metrics_daily`): superseded by
  `0006_materialized_views.sql` (`mv_user_session_averages`,
  `mv_ai_acceptance_rates`).

## Unapplied, still wanted
- Soft-delete index from `0002_daw_project_state.sql`:
  `idx_projects_user_not_deleted ON projects (user_id, updated_at DESC) WHERE deleted_at IS NULL`
- `0006_materialized_views.sql` — needed when the Time Savings feature is built.
  Drizzle cannot generate materialized views from `schema.ts`; add as a
  hand-written migration plus a journal entry.
