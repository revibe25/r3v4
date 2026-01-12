import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, boolean, timestamp, real, index } from "drizzle-orm/pg-core";

// ==================== USERS TABLE ====================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  tier: text("tier").notNull().default("free"), // free, pro, enterprise
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==================== SESSIONS TABLE ====================

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bpm: integer("bpm").notNull().default(120),
  fx: jsonb("fx").notNull().default(sql`'{}'::jsonb`),
  filterVal: real("filter_val").notNull().default(0.5),
  pitchSemitones: integer("pitch_semitones").notNull().default(0),
  recordedEvents: jsonb("recorded_events").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("sessions_user_id_idx").on(table.userId),
}));

// ==================== PROJECTS TABLE ====================

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  bpm: integer("bpm").notNull().default(120),
  timeSignature: text("time_signature").notNull().default("4/4"),
  key: text("key"),
  projectData: jsonb("project_data").notNull().default(sql`'{}'::jsonb`),
  thumbnailUrl: text("thumbnail_url"),
  filePath: text("file_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("projects_user_id_idx").on(table.userId),
}));

// ==================== SAMPLES TABLE ====================

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
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  waveformData: jsonb("waveform_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("samples_user_id_idx").on(table.userId),
}));

// ==================== PRESETS TABLE ====================

export const presets = pgTable("presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // effect-chain, instrument, pad-layout, mixer
  presetData: jsonb("preset_data").notNull(),
  isFactory: boolean("is_factory").notNull().default(false),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("presets_user_id_idx").on(table.userId),
  typeIdx: index("presets_type_idx").on(table.type),
}));

// ==================== SETTINGS TABLE ====================

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).unique(),
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

// ==================== MIDI MAPPINGS TABLE ====================

export const midiMappings = pgTable("midi_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name").notNull(),
  mappingData: jsonb("mapping_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("midi_mappings_user_id_idx").on(table.userId),
}));