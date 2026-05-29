// ─────────────────────────────────────────────────────────────────────────────
// R3 · Subscription Schema
// Drop into: shared/schema-subscription.ts
// Then re-export from shared/schema.ts:  export * from './schema-subscription';
// Run:  pnpm drizzle-kit generate  to create the migration
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
// import { relations } from 'drizzle-orm';
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_STATUSES, BILLING_CYCLES } from './subscription.types';

// ── Enums ────────────────────────────────────────────────────────────────────

export const subscriptionTierEnum = pgEnum('subscription_tier', SUBSCRIPTION_TIERS);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
export const billingCycleEnum = pgEnum('billing_cycle', BILLING_CYCLES);

// ── Subscriptions table ──────────────────────────────────────────────────────
// One row per user. Upserted on every Stripe webhook event.

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),                            // = stripe subscription id, or 'free_{userId}'
    userId: text('user_id').notNull(),
    tier: subscriptionTierEnum('tier').notNull().default('explorer'),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    billingCycle: billingCycleEnum('billing_cycle'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    trialStart: timestamp('trial_start', { withTimezone: true }),
    trialEnd: timestamp('trial_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: uniqueIndex('subscriptions_user_id_idx').on(t.userId),
    stripeCustomerIdx: index('subscriptions_stripe_customer_idx').on(t.stripeCustomerId),
  }),
);

// ── Stripe events log (idempotency guard) ────────────────────────────────────

export const stripeEvents = pgTable(
  'stripe_events',
  {
    id: text('id').primaryKey(),          // = stripe event id
    type: text('type').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
    payload: text('payload').notNull(),   // raw JSON for audit
  },
);

// ── AI transition usage (rate limiting Explorer tier) ────────────────────────


/**
 * aiTransitionUsage — C-03 fix (Mythos audit 2026-04-22)
 *
 * Rate-limit key changed from (userId, sessionId) to (userId, usageDate).
 * The sessionId column was client-controllable via the X-Session-Id header,
 * allowing any authenticated user to rotate it per-request and bypass the
 * per-session AI transition cap. Scoping to a server-generated daily date
 * (UTC) eliminates the bypass entirely: the key is now fully server-controlled.
 *
 * Daily limit enforcement: the router increments `transitionCount` and rejects
 * requests where transitionCount >= tier daily limit BEFORE calling the LLM.
 * The composite PK on (userId, usageDate) makes the upsert atomic — no race.
 */
export const aiTransitionUsage = pgTable("ai_transition_usage", {
  userId:          varchar("user_id")
                     .references(() => users.id, { onDelete: "cascade" })
                     .notNull(),
  usageDate:       text("usage_date").notNull(),           // ISO date string "YYYY-MM-DD" (UTC)
  transitionCount: integer("transition_count").notNull().default(0),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  pk:      primaryKey({ columns: [table.userId, table.usageDate] }),
  userIdx: index("ai_transition_usage_user_idx").on(table.userId),
}));

export type AiTransitionUsage    = typeof aiTransitionUsage.$inferSelect;
export type NewAiTransitionUsage = typeof aiTransitionUsage.$inferInsert;

