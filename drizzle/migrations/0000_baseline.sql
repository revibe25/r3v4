CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('explorer', 'creator', 'pro_artist');--> statement-breakpoint
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
	"timestamp" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_transition_usage" (
	"user_id" text NOT NULL,
	"usage_date" text NOT NULL,
	"transition_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_transition_usage_user_id_usage_date_pk" PRIMARY KEY("user_id","usage_date")
);
--> statement-breakpoint
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
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" text NOT NULL
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
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"tier" text DEFAULT 'explorer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"trial_started_at" timestamp,
	"trial_expires_at" timestamp,
	"is_admin" boolean DEFAULT false NOT NULL,
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
ALTER TABLE "midi_mappings" ADD CONSTRAINT "midi_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "samples" ADD CONSTRAINT "samples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_transition_usage_user_idx" ON "ai_transition_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "midi_mappings_user_id_idx" ON "midi_mappings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presets_user_id_idx" ON "presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presets_type_idx" ON "presets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "samples_user_id_idx" ON "samples" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_customer_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "usage_user_id_idx" ON "usage" USING btree ("user_id");