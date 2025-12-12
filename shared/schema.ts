import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const fxStateSchema = z.object({
  reverb: z.boolean(),
  delay: z.boolean(),
  flange: z.boolean(),
  reverse: z.boolean(),
  vinyl: z.boolean(),
});

export const recordedEventSchema = z.object({
  type: z.enum(['pad', 'key']),
  idx: z.number(),
  when: z.number(),
});

export const sessionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  bpm: z.number().min(40).max(240),
  fx: fxStateSchema,
  filterVal: z.number().min(0).max(1),
  pitchSemitones: z.number().min(-12).max(12),
  recordedEvents: z.array(recordedEventSchema),
});

export const insertSessionSchema = sessionSchema.omit({ id: true });

export type FXState = z.infer<typeof fxStateSchema>;
export type RecordedEvent = z.infer<typeof recordedEventSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
