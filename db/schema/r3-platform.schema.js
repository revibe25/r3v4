import { pgTable, text, real, boolean, timestamp, jsonb, serial, integer, varchar, } from "drizzle-orm/pg-core";
/**
 * R3 Platform — canonical Drizzle schema.
 * This is the single source of truth for all table definitions.
 * Run: pnpm drizzle-kit check  — before deploying any changes.
 */
export const users = pgTable("users", {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const projects = pgTable("projects", {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    genre: text("genre"),
    bpm: real("bpm"),
    mixerState: jsonb("mixer_state"), // serialised MixerState
    arrangement: jsonb("arrangement"), // serialised ArrangementState
    djSession: jsonb("dj_session"), // serialised DJSession
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const audioFiles = pgTable("audio_files", {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    originalName: text("original_name").notNull(),
    storagePath: text("storage_path").notNull(),
    durationMs: real("duration_ms"),
    sampleRate: integer("sample_rate"),
    mimeType: varchar("mime_type", { length: 64 }),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
export const effectPresets = pgTable("effect_presets", {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    effectId: text("effect_id").notNull(),
    name: text("name").notNull(),
    values: jsonb("values").notNull(),
    isFactory: boolean("is_factory").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const aiMixHistory = pgTable("ai_mix_history", {
    id: serial("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    genre: text("genre").notNull(),
    targetLufs: real("target_lufs").notNull(),
    suggestions: jsonb("suggestions").notNull(),
    appliedAt: timestamp("applied_at").defaultNow().notNull(),
});
