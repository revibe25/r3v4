/**
 * server/db/schema.ts
 *
 * ROOT FIX — Bug 4 (two subscriptions tables):
 * This file previously defined its own `subscriptions` table with a schema that
 * diverged from shared/schema-subscription.ts on every important billing column:
 *   - Old: `plan text`, no stripeCustomerId, stripeSubscriptionId NOT NULL UNIQUE
 *   - New (canonical): `tier enum`, full Stripe billing columns, userId UNIQUE
 * Both targeted the same DB table name "subscriptions", guaranteeing migration
 * conflicts and runtime inconsistency.
 *
 * Fix: the local `subscriptions` table definition is removed entirely.
 * stripe-subscription.ts already imports from shared/schema-subscription.ts
 * (the authoritative definition). Callers that previously imported Subscription
 * types from here now import from shared/schema-subscription.ts directly.
 *
 * ROOT FIX — Bug 3 (users.tier default mismatch):
 * `users.tier` defaulted to "free", which is not a valid SubscriptionTier
 * ("explorer" | "creator" | "pro_artist"). Changed to "explorer" for
 * consistency. The canonical tier lives in the subscriptions table; users.tier
 * is a denormalized cache — if you want to remove the duplication entirely,
 * drop this column and always read from subscriptions.
 */

import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, jsonb, integer, boolean,
  timestamp, real, index, uuid, json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ── Re-export canonical subscription types so existing imports keep working ───
export type {
  Subscription,
  NewSubscription,
  StripeEvent,
  AiTransitionUsage,
} from '../../shared/schema-subscription';

// ==================== USERS ====================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  /**
   * Denormalized tier cache. Canonical value lives in the `subscriptions` table
   * (shared/schema-subscription.ts). Keep in sync via the Stripe webhook handler.
   * Default changed from "free" → "explorer" to match SubscriptionTier enum.
   */
  tier: text("tier").notNull().default("explorer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==================== USAGE TRACKING ====================
export const usage = pgTable("usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  mixesUsed: integer("mixes_used").notNull().default(0),
  storageUsedMb: integer("storage_used_mb").notNull().default(0),
  resetAt: timestamp("reset_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("usage_user_id_idx").on(table.userId),
}));

// ==================== SESSIONS ====================
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bpm: integer("bpm").notNull().default(120),
  fx: jsonb("fx").notNull().default(sql`'{}'::jsonb`).$type<Record<string, unknown>>(),
  filterVal: real("filter_val").notNull().default(0.5),
  pitchSemitones: integer("pitch_semitones").notNull().default(0),
  recordedEvents: jsonb("recorded_events").notNull().default(sql`'[]'::jsonb`).$type<unknown[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("sessions_user_id_idx").on(table.userId),
}));

// ==================== PROJECTS ====================
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  bpm: integer("bpm").notNull().default(120),
  timeSignature: text("time_signature").notNull().default("4/4"),
  key: text("key"),
  projectData: jsonb("project_data").notNull().default(sql`'{}'::jsonb`).$type<Record<string, unknown>>(),
  thumbnailUrl: text("thumbnail_url"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("projects_user_id_idx").on(table.userId),
}));

// ==================== SAMPLES ====================
export const samples = pgTable("samples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  duration: real("duration").notNull().default(0),
  bpm: real("bpm"),
  key: text("key"),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
  waveformData: jsonb("waveform_data").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("samples_user_id_idx").on(table.userId),
}));

// ==================== PRESETS ====================
export const presets = pgTable("presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  presetData: jsonb("preset_data").notNull().$type<Record<string, unknown>>(),
  isFactory: boolean("is_factory").notNull().default(false),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("presets_user_id_idx").on(table.userId),
  typeIdx: index("presets_type_idx").on(table.type),
}));

// ==================== SETTINGS ====================
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  audioBufferSize: integer("audio_buffer_size").notNull().default(2048),
  sampleRate: integer("sample_rate").notNull().default(48000),
  bitDepth: integer("bit_depth").notNull().default(24),
  midiEnabled: boolean("midi_enabled").notNull().default(true),
  audioInputDevice: text("audio_input_device").notNull().default("default"),
  audioOutputDevice: text("audio_output_device").notNull().default("default"),
  theme: text("theme").notNull().default("dark"),
  autoSave: boolean("auto_save").notNull().default(true),
  autoSaveInterval: integer("auto_save_interval").notNull().default(300000),
  masterVolume: real("master_volume").notNull().default(0.8),
  metronomeEnabled: boolean("metronome_enabled").notNull().default(false),
  metronomeBpm: integer("metronome_bpm").notNull().default(120),
  metronomeVolume: real("metronome_volume").notNull().default(0.5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==================== MIDI MAPPINGS ====================
export const midiMappings = pgTable("midi_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name").notNull(),
  mappingData: jsonb("mapping_data").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("midi_mappings_user_id_idx").on(table.userId),
}));

// ==================== LEGACY TABLES ====================
export const effectPresetsTable = pgTable("effect_presets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  settings: json("settings").notNull(),
  category: text("category").default("general"),
  author: text("author"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const effectChainsTable = pgTable("effect_chains", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nodes: text("nodes").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const djCuesTable = pgTable("dj_cues", {
  id: text("id").primaryKey(),
  trackId: text("track_id").notNull(),
  index: integer("index").notNull(),
  position: real("position").notNull(),
  label: text("label"),
  color: text("color"),
});

export const waveformEditsTable = pgTable("waveform_edits", {
  id: text("id").primaryKey(),
  sampleId: text("sample_id").notNull(),
  editType: text("edit_type").notNull(),
  params: text("params").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==================== TYPESCRIPT TYPES ====================
export type User               = typeof users.$inferSelect;
export type InsertUser         = typeof users.$inferInsert;
export type Usage              = typeof usage.$inferSelect;
export type InsertUsage        = typeof usage.$inferInsert;
export type Session            = typeof sessions.$inferSelect;
export type InsertSession      = typeof sessions.$inferInsert;
export type Project            = typeof projects.$inferSelect;
export type InsertProject      = typeof projects.$inferInsert;
export type Sample             = typeof samples.$inferSelect;
export type InsertSample       = typeof samples.$inferInsert;
export type Preset             = typeof presets.$inferSelect;
export type InsertPreset       = typeof presets.$inferInsert;
export type Settings           = typeof settings.$inferSelect;
export type InsertSettings     = typeof settings.$inferInsert;
export type MidiMapping        = typeof midiMappings.$inferSelect;
export type InsertMidiMapping  = typeof midiMappings.$inferInsert;

// ==================== ZOD INSERT SCHEMAS ====================
export const insertSessionSchema = createInsertSchema(sessions);
export const insertProjectSchema = createInsertSchema(projects);
export const insertSampleSchema  = createInsertSchema(samples);
export const insertPresetSchema  = createInsertSchema(presets);