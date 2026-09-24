-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."agent_status" AS ENUM('pending', 'claimed', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."plugin_status" AS ENUM('alpha', 'beta', 'stable', 'deprecated', 'sunset');--> statement-breakpoint
CREATE TYPE "public"."plugin_type" AS ENUM('agent', 'gridMode', 'export', 'copilot');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('explorer', 'creator', 'pro_artist');--> statement-breakpoint
CREATE TABLE "dj_cues" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"index" integer NOT NULL,
	"position" real NOT NULL,
	"label" text,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "effect_chains" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"nodes" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "effect_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"settings" json NOT NULL,
	"category" text DEFAULT 'general',
	"author" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"preset_data" jsonb NOT NULL,
	"is_factory" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "samples" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"duration" real DEFAULT 0 NOT NULL,
	"bpm" real,
	"key" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"waveform_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"bpm" integer DEFAULT 120 NOT NULL,
	"fx" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"filter_val" real DEFAULT 0.5 NOT NULL,
	"pitch_semitones" integer DEFAULT 0 NOT NULL,
	"recorded_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"audio_buffer_size" integer DEFAULT 2048 NOT NULL,
	"sample_rate" integer DEFAULT 48000 NOT NULL,
	"bit_depth" integer DEFAULT 24 NOT NULL,
	"midi_enabled" boolean DEFAULT true NOT NULL,
	"audio_input_device" text DEFAULT 'default' NOT NULL,
	"audio_output_device" text DEFAULT 'default' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"auto_save" boolean DEFAULT true NOT NULL,
	"auto_save_interval" integer DEFAULT 300000 NOT NULL,
	"master_volume" real DEFAULT 0.8 NOT NULL,
	"metronome_enabled" boolean DEFAULT false NOT NULL,
	"metronome_bpm" integer DEFAULT 120 NOT NULL,
	"metronome_volume" real DEFAULT 0.5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"bpm" integer DEFAULT 120 NOT NULL,
	"time_signature" text DEFAULT '4/4' NOT NULL,
	"key" text,
	"project_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thumbnail_url" text,
	"file_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"state" text DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"tier" text DEFAULT 'explorer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"trial_started_at" timestamp,
	"trial_expires_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "waveform_edits" (
	"id" text PRIMARY KEY NOT NULL,
	"sample_id" text NOT NULL,
	"edit_type" text NOT NULL,
	"params" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "midi_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"device_id" text NOT NULL,
	"device_name" text NOT NULL,
	"mapping_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"mixes_used" integer DEFAULT 0 NOT NULL,
	"storage_used_mb" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usage_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" "subscription_tier" DEFAULT 'explorer' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"billing_cycle" "billing_cycle",
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_transition_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agi_agents" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(128) NOT NULL,
	"status" "agent_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"idempotency_key" varchar(256),
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_decision_log" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"node_id" text NOT NULL,
	"action_type" text NOT NULL,
	"track_id" text,
	"input_confidence" real NOT NULL,
	"displayed_confidence" real NOT NULL,
	"decision" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"timestamp" text NOT NULL,
	"user_id" varchar
);
--> statement-breakpoint
CREATE TABLE "user_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tier" varchar(20) NOT NULL,
	"generation_quota_monthly" integer NOT NULL,
	"generation_used_this_month" integer DEFAULT 0 NOT NULL,
	"ai_inference_quota_monthly" integer,
	"ai_inference_used_this_month" integer DEFAULT 0,
	"plugin_quota_monthly" integer DEFAULT 100 NOT NULL,
	"plugin_used_this_month" integer DEFAULT 0 NOT NULL,
	"reset_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_quotas_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "session_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"bpm" integer DEFAULT 128 NOT NULL,
	"track_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"time_saved_seconds" integer DEFAULT 0 NOT NULL,
	"time_saved_ms" integer DEFAULT 0 NOT NULL,
	"peak_energy_score" real DEFAULT 0,
	"mix_quality_score" real DEFAULT 0,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "plugin_type" NOT NULL,
	"version" varchar(20) NOT NULL,
	"description" text,
	"author_id" uuid,
	"author_name" varchar(255),
	"manifest" jsonb NOT NULL,
	"worker_code_hash" varchar(100) NOT NULL,
	"signature" text NOT NULL,
	"status" "plugin_status" DEFAULT 'beta' NOT NULL,
	"published_at" timestamp with time zone,
	"reviewed_by" uuid,
	"review_notes" text,
	"security_rating" varchar(1),
	"download_count" integer DEFAULT 0 NOT NULL,
	"rating" integer,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"tier_access" jsonb DEFAULT '["pro-artist","founder"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "plugins_plugin_id_key" UNIQUE("plugin_id")
);
--> statement-breakpoint
CREATE TABLE "metrics_kv" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "diagnostic_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"severity" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"fix" text,
	"auto_apply" boolean DEFAULT false NOT NULL,
	"session_id" text,
	"project_id" text,
	"agent_id" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plugin_id" uuid NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"latency_ms" integer,
	"error_message" text,
	"month" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"plugin_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "samples" ADD CONSTRAINT "samples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "midi_mappings" ADD CONSTRAINT "midi_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "presets_type_idx" ON "presets" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "presets_user_id_idx" ON "presets" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "samples_user_id_idx" ON "samples" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "midi_mappings_user_id_idx" ON "midi_mappings" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "usage_user_id_idx" ON "usage" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_customer_idx" ON "subscriptions" USING btree ("stripe_customer_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "agi_agents_idempotency_key_idx" ON "agi_agents" USING btree ("idempotency_key" text_ops) WHERE (idempotency_key IS NOT NULL);--> statement-breakpoint
CREATE INDEX "agi_agents_status_idx" ON "agi_agents" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_ai_decision_log_user_id" ON "ai_decision_log" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_quotas_reset" ON "user_quotas" USING btree ("reset_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_quotas_tier" ON "user_quotas" USING btree ("tier" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plugins_author" ON "plugins" USING btree ("author_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_plugins_plugin_id_unique" ON "plugins" USING btree ("plugin_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plugins_status" ON "plugins" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_plugins_type" ON "plugins" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "diag_agent_resolved_idx" ON "diagnostic_findings" USING btree ("agent_id" bool_ops,"resolved" text_ops);--> statement-breakpoint
CREATE INDEX "diag_session_id_idx" ON "diagnostic_findings" USING btree ("session_id" text_ops);--> statement-breakpoint
CREATE INDEX "diag_severity_idx" ON "diagnostic_findings" USING btree ("severity" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plugin_usage_plugin" ON "plugin_usage" USING btree ("plugin_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_plugin_usage_user_month" ON "plugin_usage" USING btree ("user_id" timestamptz_ops,"month" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_plugin_usage_user_plugin" ON "plugin_usage" USING btree ("user_id" uuid_ops,"plugin_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_admin" ON "plugin_audit_logs" USING btree ("admin_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "plugin_audit_logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_audit_plugin" ON "plugin_audit_logs" USING btree ("plugin_id" uuid_ops);
*/