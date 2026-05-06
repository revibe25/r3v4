import { pgTable, text, jsonb, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const arrangements = pgTable("arrangements", {
  id:            text("id").primaryKey(),
  userId:        text("user_id").notNull(),
  name:          text("name").notNull().default("Untitled Project"),
  tempo:         integer("tempo").notNull().default(120),
  timeSignatureN: integer("time_signature_n").notNull().default(4),
  timeSignatureD: integer("time_signature_d").notNull().default(4),
  lengthBars:    integer("length_bars").notNull().default(64),
  loopRange:     jsonb("loop_range").notNull().default({ startBar: 1, endBar: 5, enabled: false }),
  tracks:        jsonb("tracks").notNull().default([]),
  markers:       jsonb("markers").notNull().default([]),
  isPublic:      boolean("is_public").notNull().default(false),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

export const insertArrangementSchema = createInsertSchema(arrangements);
export const selectArrangementSchema = createSelectSchema(arrangements);
export type InsertArrangement = typeof arrangements.$inferInsert;
export type SelectArrangement = typeof arrangements.$inferSelect;
