-- Add unique constraint to enforce 1-project limit for free-tier users
-- Prevents TOCTOU race: two concurrent requests both pass app-level check
-- Mythos-Audit F-04 (2026-07-15)

CREATE UNIQUE INDEX idx_projects_free_tier_one_active 
  ON projects(user_id) 
  WHERE deleted_at IS NULL AND tier = 'explorer';
