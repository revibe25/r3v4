import { relations } from "drizzle-orm/relations";
import { users, presets, samples, sessions, settings, projects, midiMappings, usage, aiDecisionLog } from "./schema";

export const presetsRelations = relations(presets, ({one}) => ({
	user: one(users, {
		fields: [presets.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	presets: many(presets),
	samples: many(samples),
	sessions: many(sessions),
	settings: many(settings),
	projects: many(projects),
	midiMappings: many(midiMappings),
	usages: many(usage),
	aiDecisionLogs: many(aiDecisionLog),
}));

export const samplesRelations = relations(samples, ({one}) => ({
	user: one(users, {
		fields: [samples.userId],
		references: [users.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const settingsRelations = relations(settings, ({one}) => ({
	user: one(users, {
		fields: [settings.userId],
		references: [users.id]
	}),
}));

export const projectsRelations = relations(projects, ({one}) => ({
	user: one(users, {
		fields: [projects.userId],
		references: [users.id]
	}),
}));

export const midiMappingsRelations = relations(midiMappings, ({one}) => ({
	user: one(users, {
		fields: [midiMappings.userId],
		references: [users.id]
	}),
}));

export const usageRelations = relations(usage, ({one}) => ({
	user: one(users, {
		fields: [usage.userId],
		references: [users.id]
	}),
}));

export const aiDecisionLogRelations = relations(aiDecisionLog, ({one}) => ({
	user: one(users, {
		fields: [aiDecisionLog.userId],
		references: [users.id]
	}),
}));