import { pgTable, text, integer, real, timestamp, uuid, json, index, foreignKey, varchar, jsonb, boolean, unique, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const agentStatus = pgEnum("agent_status", ['pending', 'claimed', 'running', 'done', 'failed'])
export const billingCycle = pgEnum("billing_cycle", ['monthly', 'annual'])
export const pluginStatus = pgEnum("plugin_status", ['alpha', 'beta', 'stable', 'deprecated', 'sunset'])
export const pluginType = pgEnum("plugin_type", ['agent', 'gridMode', 'export', 'copilot'])
export const subscriptionStatus = pgEnum("subscription_status", ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused'])
export const subscriptionTier = pgEnum("subscription_tier", ['explorer', 'creator', 'pro_artist'])


export const djCues = pgTable("dj_cues", {
	id: text().primaryKey().notNull(),
	trackId: text("track_id").notNull(),
	index: integer().notNull(),
	position: real().notNull(),
	label: text(),
	color: text(),
});

export const effectChains = pgTable("effect_chains", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	nodes: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const effectPresets = pgTable("effect_presets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	settings: json().notNull(),
	category: text().default('general'),
	author: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const presets = pgTable("presets", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id"),
	name: text().notNull(),
	description: text(),
	type: text().notNull(),
	presetData: jsonb("preset_data").notNull(),
	isFactory: boolean("is_factory").default(false).notNull(),
	tags: jsonb().default([]).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("presets_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("presets_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "presets_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const samples = pgTable("samples", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id"),
	name: text().notNull(),
	filePath: text("file_path").notNull(),
	fileName: text("file_name").notNull(),
	fileSize: integer("file_size").notNull(),
	mimeType: text("mime_type").notNull(),
	duration: real().default(0).notNull(),
	bpm: real(),
	key: text(),
	tags: jsonb().default([]).notNull(),
	waveformData: jsonb("waveform_data"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("samples_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "samples_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const sessions = pgTable("sessions", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	name: text().notNull(),
	bpm: integer().default(120).notNull(),
	fx: jsonb().default({}).notNull(),
	filterVal: real("filter_val").default(0.5).notNull(),
	pitchSemitones: integer("pitch_semitones").default(0).notNull(),
	recordedEvents: jsonb("recorded_events").default([]).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sessions_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const settings = pgTable("settings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id"),
	audioBufferSize: integer("audio_buffer_size").default(2048).notNull(),
	sampleRate: integer("sample_rate").default(48000).notNull(),
	bitDepth: integer("bit_depth").default(24).notNull(),
	midiEnabled: boolean("midi_enabled").default(true).notNull(),
	audioInputDevice: text("audio_input_device").default('default').notNull(),
	audioOutputDevice: text("audio_output_device").default('default').notNull(),
	theme: text().default('dark').notNull(),
	autoSave: boolean("auto_save").default(true).notNull(),
	autoSaveInterval: integer("auto_save_interval").default(300000).notNull(),
	masterVolume: real("master_volume").default(0.8).notNull(),
	metronomeEnabled: boolean("metronome_enabled").default(false).notNull(),
	metronomeBpm: integer("metronome_bpm").default(120).notNull(),
	metronomeVolume: real("metronome_volume").default(0.5).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "settings_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("settings_user_id_unique").on(table.userId),
]);

export const projects = pgTable("projects", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	name: text().notNull(),
	description: text(),
	bpm: integer().default(120).notNull(),
	timeSignature: text("time_signature").default('4/4').notNull(),
	key: text(),
	projectData: jsonb("project_data").default({}).notNull(),
	thumbnailUrl: text("thumbnail_url"),
	filePath: text("file_path"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	state: text().default('{}').notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("projects_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "projects_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	email: text(),
	tier: text().default('explorer').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isAdmin: boolean("is_admin").default(false).notNull(),
	trialStartedAt: timestamp("trial_started_at", { mode: 'string' }),
	trialExpiresAt: timestamp("trial_expires_at", { mode: 'string' }),
}, (table) => [
	unique("users_username_unique").on(table.username),
]);

export const waveformEdits = pgTable("waveform_edits", {
	id: text().primaryKey().notNull(),
	sampleId: text("sample_id").notNull(),
	editType: text("edit_type").notNull(),
	params: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const midiMappings = pgTable("midi_mappings", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id"),
	name: text().notNull(),
	deviceId: text("device_id").notNull(),
	deviceName: text("device_name").notNull(),
	mappingData: jsonb("mapping_data").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("midi_mappings_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "midi_mappings_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const usage = pgTable("usage", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	mixesUsed: integer("mixes_used").default(0).notNull(),
	storageUsedMb: integer("storage_used_mb").default(0).notNull(),
	resetAt: timestamp("reset_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("usage_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "usage_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("usage_user_id_unique").on(table.userId),
]);

export const subscriptions = pgTable("subscriptions", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	tier: subscriptionTier().default('explorer').notNull(),
	status: subscriptionStatus().default('active').notNull(),
	billingCycle: billingCycle("billing_cycle"),
	stripeCustomerId: text("stripe_customer_id"),
	stripeSubscriptionId: text("stripe_subscription_id"),
	stripePriceId: text("stripe_price_id"),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	canceledAt: timestamp("canceled_at", { withTimezone: true, mode: 'string' }),
	trialStart: timestamp("trial_start", { withTimezone: true, mode: 'string' }),
	trialEnd: timestamp("trial_end", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("subscriptions_stripe_customer_idx").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
	uniqueIndex("subscriptions_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const stripeEvents = pgTable("stripe_events", {
	id: text().primaryKey().notNull(),
	type: text().notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	payload: text().notNull(),
});

export const aiTransitionUsage = pgTable("ai_transition_usage", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	sessionId: text("session_id").notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const agiAgents = pgTable("agi_agents", {
	id: uuid().defaultRandom().notNull(),
	type: varchar({ length: 128 }).notNull(),
	status: agentStatus().default('pending').notNull(),
	payload: jsonb().default({}).notNull(),
	result: jsonb(),
	error: text(),
	idempotencyKey: varchar("idempotency_key", { length: 256 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("agi_agents_idempotency_key_idx").using("btree", table.idempotencyKey.asc().nullsLast().op("text_ops")).where(sql`(idempotency_key IS NOT NULL)`),
	index("agi_agents_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
]);

export const aiDecisionLog = pgTable("ai_decision_log", {
	id: text().primaryKey().notNull(),
	sessionId: text("session_id").notNull(),
	nodeId: text("node_id").notNull(),
	actionType: text("action_type").notNull(),
	trackId: text("track_id"),
	inputConfidence: real("input_confidence").notNull(),
	displayedConfidence: real("displayed_confidence").notNull(),
	decision: jsonb().notNull(),
	outcome: text().notNull(),
	latencyMs: integer("latency_ms").notNull(),
	timestamp: text().notNull(),
	userId: varchar("user_id"),
}, (table) => [
	index("idx_ai_decision_log_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ai_decision_log_user_id_fkey"
		}).onDelete("cascade"),
]);

export const userQuotas = pgTable("user_quotas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tier: varchar({ length: 20 }).notNull(),
	generationQuotaMonthly: integer("generation_quota_monthly").notNull(),
	generationUsedThisMonth: integer("generation_used_this_month").default(0).notNull(),
	aiInferenceQuotaMonthly: integer("ai_inference_quota_monthly"),
	aiInferenceUsedThisMonth: integer("ai_inference_used_this_month").default(0),
	pluginQuotaMonthly: integer("plugin_quota_monthly").default(100).notNull(),
	pluginUsedThisMonth: integer("plugin_used_this_month").default(0).notNull(),
	resetDate: timestamp("reset_date", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_quotas_reset").using("btree", table.resetDate.asc().nullsLast().op("timestamptz_ops")),
	index("idx_quotas_tier").using("btree", table.tier.asc().nullsLast().op("text_ops")),
	unique("user_quotas_user_id_key").on(table.userId),
]);

export const sessionMetrics = pgTable("session_metrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	userId: text("user_id").notNull(),
	bpm: integer().default(128).notNull(),
	trackIds: jsonb("track_ids").default([]).notNull(),
	durationSeconds: integer("duration_seconds").default(0).notNull(),
	timeSavedSeconds: integer("time_saved_seconds").default(0).notNull(),
	timeSavedMs: integer("time_saved_ms").default(0).notNull(),
	peakEnergyScore: real("peak_energy_score").default(0),
	mixQualityScore: real("mix_quality_score").default(0),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow().notNull(),
	endedAt: timestamp("ended_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const plugins = pgTable("plugins", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	pluginId: varchar("plugin_id", { length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	type: pluginType().notNull(),
	version: varchar({ length: 20 }).notNull(),
	description: text(),
	authorId: uuid("author_id"),
	authorName: varchar("author_name", { length: 255 }),
	manifest: jsonb().notNull(),
	workerCodeHash: varchar("worker_code_hash", { length: 100 }).notNull(),
	signature: text().notNull(),
	status: pluginStatus().default('beta').notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	reviewedBy: uuid("reviewed_by"),
	reviewNotes: text("review_notes"),
	securityRating: varchar("security_rating", { length: 1 }),
	downloadCount: integer("download_count").default(0).notNull(),
	rating: integer(),
	ratingCount: integer("rating_count").default(0).notNull(),
	tierAccess: jsonb("tier_access").default(["pro-artist","founder"]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_plugins_author").using("btree", table.authorId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("idx_plugins_plugin_id_unique").using("btree", table.pluginId.asc().nullsLast().op("text_ops")),
	index("idx_plugins_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("idx_plugins_type").using("btree", table.type.asc().nullsLast().op("enum_ops")),
	unique("plugins_plugin_id_key").on(table.pluginId),
]);

export const metricsKv = pgTable("metrics_kv", {
	key: varchar({ length: 64 }).primaryKey().notNull(),
	value: text().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const diagnosticFindings = pgTable("diagnostic_findings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	severity: text().notNull(),
	category: text().notNull(),
	message: text().notNull(),
	fix: text(),
	autoApply: boolean("auto_apply").default(false).notNull(),
	sessionId: text("session_id"),
	projectId: text("project_id"),
	agentId: text("agent_id").notNull(),
	resolved: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("diag_agent_resolved_idx").using("btree", table.agentId.asc().nullsLast().op("bool_ops"), table.resolved.asc().nullsLast().op("text_ops")),
	index("diag_session_id_idx").using("btree", table.sessionId.asc().nullsLast().op("text_ops")),
	index("diag_severity_idx").using("btree", table.severity.asc().nullsLast().op("text_ops")),
]);

export const pluginUsage = pgTable("plugin_usage", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	pluginId: uuid("plugin_id").notNull(),
	actionType: varchar("action_type", { length: 50 }).notNull(),
	input: jsonb(),
	output: jsonb(),
	latencyMs: integer("latency_ms"),
	errorMessage: text("error_message"),
	month: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_plugin_usage_plugin").using("btree", table.pluginId.asc().nullsLast().op("uuid_ops")),
	index("idx_plugin_usage_user_month").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.month.asc().nullsLast().op("timestamptz_ops")),
	index("idx_plugin_usage_user_plugin").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.pluginId.asc().nullsLast().op("uuid_ops")),
]);

export const pluginAuditLogs = pgTable("plugin_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	adminId: uuid("admin_id").notNull(),
	pluginId: uuid("plugin_id").notNull(),
	action: varchar({ length: 50 }).notNull(),
	details: jsonb(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_audit_admin").using("btree", table.adminId.asc().nullsLast().op("uuid_ops")),
	index("idx_audit_created").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_audit_plugin").using("btree", table.pluginId.asc().nullsLast().op("uuid_ops")),
]);
