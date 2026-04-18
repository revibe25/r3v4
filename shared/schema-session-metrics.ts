import { pgTable, uuid, integer, real, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const sessionMetrics = pgTable("session_metrics", {
  id:             uuid("id").defaultRandom().primaryKey(),
  sessionId:      uuid("session_id").notNull(),
  userId:         text("user_id").notNull(),
  bpm:            integer("bpm").notNull().default(128),
  trackIds:       jsonb("track_ids").$type<string[]>().notNull().default([]),
  durationSeconds:integer("duration_seconds").notNull().default(0),
  timeSavedSeconds:integer("time_saved_seconds").notNull().default(0),
  peakEnergyScore:real("peak_energy_score").default(0),
  mixQualityScore:real("mix_quality_score").default(0),
  startedAt:      timestamp("started_at").notNull().defaultNow(),
  endedAt:        timestamp("ended_at"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  timeSavedMs: integer("time_saved_ms").notNull().default(0),
});

export const insertSessionMetricsSchema = createInsertSchema(sessionMetrics);
export const selectSessionMetricsSchema = createSelectSchema(sessionMetrics);

export type InsertSessionMetrics = typeof sessionMetrics.$inferInsert;
export type SelectSessionMetrics = typeof sessionMetrics.$inferSelect;
