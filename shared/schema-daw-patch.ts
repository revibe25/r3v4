/**
 * shared/schema-daw-patch.ts
 *
 * Drizzle ORM schema additions for the DAW project persistence layer.
 * Merge these columns into the `projects` table definition in shared/schema.ts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * In shared/schema.ts, find your existing `projects` table definition and
 * add the two highlighted columns:
 *
 *   export const projects = pgTable('projects', {
 *     id:        uuid('id').primaryKey().defaultRandom(),
 *     userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
 *     name:      varchar('name', { length: 80 }).notNull(),
 *
 *     // ── ADD THESE ──────────────────────────────────────────────────────────
 *     state:     text('state').notNull().default('{}'),
 *     deletedAt: timestamp('deleted_at', { withTimezone: true }),
 *     // ───────────────────────────────────────────────────────────────────────
 *
 *     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
 *     updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FULL schema for reference (copy-paste safe):
 */

import {
  pgTable, uuid, varchar, text, timestamp, boolean, integer, real,
} from 'drizzle-orm/pg-core';

// ── users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── subscriptions ─────────────────────────────────────────────────────────────
export const subscriptions = pgTable('subscriptions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubId:      varchar('stripe_subscription_id', { length: 255 }),
  tier:             varchar('tier', { length: 20 }).notNull().default('free'),  // 'free' | 'pro' | 'elite'
  status:           varchar('status', { length: 20 }).notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── projects (with state blob + soft delete) ──────────────────────────────────
export const projects = pgTable('projects', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:      varchar('name', { length: 80 }).notNull(),
  // Full DAW state serialised as JSON by useDAWStore serialiseProjectState()
  state:     text('state').notNull().default('{}'),
  // Soft delete — rows with non-null deletedAt are excluded from all queries
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── presets ───────────────────────────────────────────────────────────────────
export const presets = pgTable('presets', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:      varchar('name', { length: 80 }).notNull(),
  category:  varchar('category', { length: 40 }),
  data:      text('data').notNull().default('{}'),
  isPublic:  boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Type exports (used by server/routers/daw.ts) ──────────────────────────────
export type User         = typeof users.$inferSelect;
export type NewUser      = typeof users.$inferInsert;
export type Project      = typeof projects.$inferSelect;
export type NewProject   = typeof projects.$inferInsert;
export type Preset       = typeof presets.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;