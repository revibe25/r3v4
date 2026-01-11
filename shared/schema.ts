import { z } from "zod";

// ==================== FX STATE SCHEMA ====================

export const fxStateSchema = z.object({
  reverb: z.boolean().default(false),
  delay: z.boolean().default(false),
  flanger: z.boolean().default(false),
  reverse: z.boolean().default(false),
  vinyl: z.boolean().default(false),
  distortion: z.boolean().default(false),
  compressor: z.boolean().default(false),
  eq: z.boolean().default(false),
});

export type FXState = z.infer<typeof fxStateSchema>;

// ==================== RECORDED EVENT SCHEMA ====================

export const recordedEventSchema = z.object({
  type: z.enum(['pad', 'key', 'knob', 'fx']),
  idx: z.number(),
  when: z.number(),
  velocity: z.number().min(0).max(1).optional(),
  duration: z.number().optional(),
});

export type RecordedEvent = z.infer<typeof recordedEventSchema>;

// ==================== USER SCHEMAS ====================

export const insertUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  email: z.string().email().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export interface User {
  id: string;
  username: string;
  password: string;
  email?: string | null;
  tier: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== SESSION SCHEMAS ====================

export const insertSessionSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(1).max(100),
  bpm: z.number().min(40).max(240),
  fx: fxStateSchema,
  filterVal: z.number().min(0).max(1),
  pitchSemitones: z.number().min(-12).max(12),
  recordedEvents: z.array(recordedEventSchema),
});

export type InsertSession = z.infer<typeof insertSessionSchema>;

export interface Session extends InsertSession {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== PROJECT SCHEMAS ====================

export const insertProjectSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  bpm: z.number().min(40).max(240).default(120),
  timeSignature: z.string().default("4/4"),
  key: z.string().optional(),
  projectData: z.record(z.unknown()).default({}),
  thumbnailUrl: z.string().optional(),
  filePath: z.string().optional(),
});

export type InsertProject = z.infer<typeof insertProjectSchema>;

export interface Project extends InsertProject {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== SAMPLE SCHEMAS ====================

export const insertSampleSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(1).max(200),
  filePath: z.string(),
  fileName: z.string(),
  fileSize: z.number().positive(),
  mimeType: z.string(),
  duration: z.number().nonnegative().default(0),
  bpm: z.number().min(40).max(240).optional(),
  key: z.string().optional(),
  tags: z.array(z.string()).default([]),
  waveformData: z.array(z.number()).optional(),
});

export type InsertSample = z.infer<typeof insertSampleSchema>;

export interface Sample extends InsertSample {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== PRESET SCHEMAS ====================

export const insertPresetSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['effect-chain', 'instrument', 'pad-layout', 'mixer', 'dj-settings']),
  presetData: z.record(z.unknown()),
  isFactory: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export type InsertPreset = z.infer<typeof insertPresetSchema>;

export interface Preset extends InsertPreset {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== SETTINGS SCHEMAS ====================

export const insertSettingsSchema = z.object({
  userId: z.string().optional(),
  audioBufferSize: z.number().min(128).max(8192).default(2048),
  sampleRate: z.number().refine(val => [44100, 48000, 96000].includes(val)).default(48000),
  bitDepth: z.number().refine(val => [16, 24, 32].includes(val)).default(24),
  midiEnabled: z.boolean().default(true),
  audioInputDevice: z.string().default("default"),
  audioOutputDevice: z.string().default("default"),
  theme: z.enum(['dark', 'light']).default("dark"),
  autoSave: z.boolean().default(true),
  autoSaveInterval: z.number().min(60000).max(600000).default(300000),
  masterVolume: z.number().min(0).max(1).default(0.8),
  metronomeEnabled: z.boolean().default(false),
  metronomeBpm: z.number().min(40).max(240).default(120),
  metronomeVolume: z.number().min(0).max(1).default(0.5),
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export interface Settings extends InsertSettings {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== MIDI MAPPING SCHEMAS ====================

export const insertMidiMappingSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(1).max(100),
  deviceId: z.string(),
  deviceName: z.string(),
  mappingData: z.record(z.unknown()),
});

export type InsertMidiMapping = z.infer<typeof insertMidiMappingSchema>;

export interface MidiMapping extends InsertMidiMapping {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== EFFECT PARAMETER SCHEMAS ====================

export const reverbParamsSchema = z.object({
  type: z.enum(['room', 'hall', 'plate']).default('hall'),
  decay: z.number().min(0).max(10).default(2),
  wet: z.number().min(0).max(1).default(0.3),
  dry: z.number().min(0).max(1).default(0.7),
});

export const delayParamsSchema = z.object({
  time: z.number().min(0).max(2).default(0.5),
  feedback: z.number().min(0).max(0.9).default(0.3),
  wet: z.number().min(0).max(1).default(0.3),
  dry: z.number().min(0).max(1).default(0.7),
  sync: z.boolean().default(false),
});

export const filterParamsSchema = z.object({
  type: z.enum(['lowpass', 'highpass', 'bandpass']).default('lowpass'),
  frequency: z.number().min(20).max(20000).default(1000),
  resonance: z.number().min(0).max(30).default(1),
  wet: z.number().min(0).max(1).default(1),
});

export const distortionParamsSchema = z.object({
  drive: z.number().min(0).max(1).default(0.5),
  tone: z.number().min(0).max(1).default(0.5),
  wet: z.number().min(0).max(1).default(0.5),
  dry: z.number().min(0).max(1).default(0.5),
});

export const compressorParamsSchema = z.object({
  threshold: z.number().min(-60).max(0).default(-24),
  ratio: z.number().min(1).max(20).default(4),
  attack: z.number().min(0).max(1).default(0.003),
  release: z.number().min(0).max(1).default(0.25),
  knee: z.number().min(0).max(40).default(30),
});

export const eqParamsSchema = z.object({
  low: z.number().min(-24).max(24).default(0),
  mid: z.number().min(-24).max(24).default(0),
  high: z.number().min(-24).max(24).default(0),
  lowFreq: z.number().min(20).max(500).default(100),
  midFreq: z.number().min(200).max(5000).default(1000),
  highFreq: z.number().min(2000).max(20000).default(8000),
});

export type ReverbParams = z.infer<typeof reverbParamsSchema>;
export type DelayParams = z.infer<typeof delayParamsSchema>;
export type FilterParams = z.infer<typeof filterParamsSchema>;
export type DistortionParams = z.infer<typeof distortionParamsSchema>;
export type CompressorParams = z.infer<typeof compressorParamsSchema>;
export type EQParams = z.infer<typeof eqParamsSchema>;