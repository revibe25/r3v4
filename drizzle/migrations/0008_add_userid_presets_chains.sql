-- 0008_add_userid_presets_chains.sql
-- Security: adds user_id FK to tables that were missing ownership scoping.
-- Nullable initially to avoid breaking existing rows in dev/staging.
-- Add NOT NULL constraint after backfill or on fresh db.

ALTER TABLE "effect_presets" ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id);
ALTER TABLE effect_chains ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id);
ALTER TABLE waveform_edits ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id);

-- Index for userId lookups (all three tables)
CREATE INDEX IF NOT EXISTS idx_effect_presets_user_id ON "effect_presets"(user_id);
CREATE INDEX IF NOT EXISTS idx_effect_chains_user_id ON effect_chains(user_id);
CREATE INDEX IF NOT EXISTS idx_waveform_edits_user_id ON waveform_edits(user_id);

