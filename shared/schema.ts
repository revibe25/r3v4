import {
  pgTable, uuid, text, timestamp, boolean, integer, jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  role: text("role").default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const effectPresets = pgTable("effect_presets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  settings: jsonb("settings").notNull(),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mixes = pgTable("mixes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  inputFile: text("input_file").notNull(),
  outputFile: text("output_file"),
  status: text("status").notNull(),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usage = pgTable("usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  mixesUsed: integer("mixes_used").default(0),
  storageUsedMb: integer("storage_used_mb").default(0),
  resetAt: timestamp("reset_at"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const samples = pgTable("samples", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod insert schemas for request validation
export const insertSessionSchema = createInsertSchema(sessions);
export const insertProjectSchema = createInsertSchema(projects);
export const insertSampleSchema  = createInsertSchema(samples);
export const insertPresetSchema  = createInsertSchema(effectPresets);

// TypeScript types
export type User               = typeof users.$inferSelect;
export type InsertUser         = typeof users.$inferInsert;
export type Subscription       = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
export type EffectPreset       = typeof effectPresets.$inferSelect;
export type InsertEffectPreset = typeof effectPresets.$inferInsert;
export type Mix                = typeof mixes.$inferSelect;
export type InsertMix          = typeof mixes.$inferInsert;
export type Usage              = typeof usage.$inferSelect;
export type InsertUsage        = typeof usage.$inferInsert;
export type Session            = typeof sessions.$inferSelect;
export type InsertSession      = typeof sessions.$inferInsert;
export type Project            = typeof projects.$inferSelect;
export type InsertProject      = typeof projects.$inferInsert;
export type Sample             = typeof samples.$inferSelect;
export type InsertSample       = typeof samples.$inferInsert;
