/**
 * shared/schema.ts
 *
 * Fix C3 — Remove shadowing `subscriptions` table export
 *
 * ROOT CAUSE: ES module spec — a named local export always wins over
 * export * from './y' when both export the same name. This file defined
 * its own `subscriptions` pgTable (old schema: plan: text, no tier enum,
 * no stripeCustomerId) AND did `export * from './schema-subscription'` at
 * the bottom. The local const suppressed the canonical export silently.
 * Any code importing `subscriptions` from this file received the old table
 * definition. Stripe webhook writes and subscription reads were targeting
 * different table schemas.
 *
 * Fix M4 — Remove orphaned `users` table export
 *
 * ROOT CAUSE: This file defined a `users` table (id: uuid, email as primary
 * identifier) that conflicted with server/db/schema.ts users table (id:
 * varchar, username as primary identifier). Both targeted the DB table
 * "users" with irreconcilable column sets. Grep confirmed zero server files
 * import from shared/schema — only client/header-controls.tsx imports
 * Session type. The users table export here was entirely unused. Removing it
 * eliminates the FK reference chain conflict and the irreconcilable dual
 * definition. The canonical users table lives in server/db/schema.ts only.
 *
 * WHY THIS FIX IS CORRECT:
 * After removing the local `subscriptions` const, `export * from
 * './schema-subscription'` now correctly exports the canonical table
 * (tier enum, stripeCustomerId, full billing columns). All callers that
 * import `subscriptions` from shared/schema now get the right definition.
 * The remaining tables (effectPresets, mixes, usage, sessions, projects,
 * samples) are kept intact because the client imports Session from here.
 */

import {
  pgTable, uuid, text, timestamp, boolean, integer, jsonb, pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const OUTCOME_VALUES = ['auto_applied', 'accepted', 'rejected', 'ignored', 'discarded'] as const;
export const outcomeEnum = pgEnum('outcome', OUTCOME_VALUES);

// ── Effect Presets ────────────────────────────────────────────────────────────
export const effectPresets = pgTable("effect_presets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  settings: jsonb("settings").notNull(),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Mixes ─────────────────────────────────────────────────────────────────────
export const mixes = pgTable("mixes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  inputFile: text("input_file").notNull(),
  outputFile: text("output_file"),
  status: text("status").notNull(),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Usage ─────────────────────────────────────────────────────────────────────
export const usageTable = pgTable("usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  mixesUsed: integer("mixes_used").default(0),
  storageUsedMb: integer("storage_used_mb").default(0),
  resetAt: timestamp("reset_at"),
});

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Projects ──────────────────────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  state:     text('state').notNull().default('{}'),
  deletedAt:  timestamp('deleted_at', { withTimezone: true }),
});

// ── Samples ───────────────────────────────────────────────────────────────────
export const samples = pgTable("samples", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Zod insert schemas ────────────────────────────────────────────────────────
export const insertSessionSchema = createInsertSchema(sessions);
export const insertProjectSchema = createInsertSchema(projects);
export const insertSampleSchema  = createInsertSchema(samples);
export const insertPresetSchema  = createInsertSchema(effectPresets);

// ── TypeScript types ──────────────────────────────────────────────────────────
export type EffectPreset       = typeof effectPresets.$inferSelect;
export type InsertEffectPreset = typeof effectPresets.$inferInsert;
export type Mix                = typeof mixes.$inferSelect;
export type InsertMix          = typeof mixes.$inferInsert;
export type Session            = typeof sessions.$inferSelect;
export type InsertSession      = typeof sessions.$inferInsert;
export type Project            = typeof projects.$inferSelect;
export type InsertProject      = typeof projects.$inferInsert;
export type Sample             = typeof samples.$inferSelect;
export type InsertSample       = typeof samples.$inferInsert;

// ── Re-exports ────────────────────────────────────────────────────────────────
// Fix C3: local `subscriptions` removed — this now correctly exports the
// canonical table and types from schema-subscription.ts without shadowing.
export * from './schema-subscription';
export * from './types';
export * from './subscription.types';