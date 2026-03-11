-- ─────────────────────────────────────────────────────────────────────────────
-- R3 · Subscription Tables Migration
-- File: drizzle/migrations/0002_subscription_tables.sql
-- Run:  pnpm drizzle-kit migrate  OR  pnpm tsx server/scripts/migrate.ts
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('explorer', 'creator', 'pro_artist');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'paused'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Subscriptions (one row per user)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL,
  tier                   subscription_tier NOT NULL DEFAULT 'explorer',
  status                 subscription_status NOT NULL DEFAULT 'active',
  billing_cycle          billing_cycle,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id        TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at            TIMESTAMPTZ,
  trial_start            TIMESTAMPTZ,
  trial_end              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_idx
  ON subscriptions (user_id);

CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON subscriptions (stripe_customer_id);

-- Stripe events (idempotency log)
CREATE TABLE IF NOT EXISTS stripe_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload      TEXT NOT NULL
);

-- AI transition usage (for per-session rate limiting on Explorer tier)
CREATE TABLE IF NOT EXISTS ai_transition_usage (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  session_id TEXT NOT NULL,
  used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_session_idx
  ON ai_transition_usage (user_id, session_id);
