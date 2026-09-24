CREATE TYPE "public"."outcome" AS ENUM('auto_applied', 'accepted', 'rejected', 'ignored', 'discarded');--> statement-breakpoint
CREATE TABLE "mixes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"input_file" text NOT NULL,
	"output_file" text,
	"status" text NOT NULL,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dj_cues" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "effect_chains" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waveform_edits" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "midi_mappings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agi_agents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_decision_log" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_quotas" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plugins" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "metrics_kv" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "diagnostic_findings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plugin_usage" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plugin_audit_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "dj_cues" CASCADE;--> statement-breakpoint
DROP TABLE "effect_chains" CASCADE;--> statement-breakpoint
DROP TABLE "settings" CASCADE;--> statement-breakpoint
DROP TABLE "waveform_edits" CASCADE;--> statement-breakpoint
DROP TABLE "midi_mappings" CASCADE;--> statement-breakpoint
DROP TABLE "agi_agents" CASCADE;--> statement-breakpoint
DROP TABLE "ai_decision_log" CASCADE;--> statement-breakpoint
DROP TABLE "user_quotas" CASCADE;--> statement-breakpoint
DROP TABLE "plugins" CASCADE;--> statement-breakpoint
DROP TABLE "metrics_kv" CASCADE;--> statement-breakpoint
DROP TABLE "diagnostic_findings" CASCADE;--> statement-breakpoint
DROP TABLE "plugin_usage" CASCADE;--> statement-breakpoint
DROP TABLE "plugin_audit_logs" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
ALTER TABLE "usage" DROP CONSTRAINT "usage_user_id_unique";--> statement-breakpoint
ALTER TABLE "samples" DROP CONSTRAINT "samples_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "usage" DROP CONSTRAINT "usage_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "presets_type_idx";--> statement-breakpoint
DROP INDEX "presets_user_id_idx";--> statement-breakpoint
DROP INDEX "samples_user_id_idx";--> statement-breakpoint
DROP INDEX "sessions_user_id_idx";--> statement-breakpoint
DROP INDEX "projects_user_id_idx";--> statement-breakpoint
DROP INDEX "usage_user_id_idx";--> statement-breakpoint
DROP INDEX "subscriptions_stripe_customer_idx";--> statement-breakpoint
DROP INDEX "subscriptions_user_id_idx";--> statement-breakpoint
ALTER TABLE "effect_presets" ALTER COLUMN "settings" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "presets" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "presets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "presets" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "presets" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "presets" ALTER COLUMN "name" SET DATA TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "presets" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "presets" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "presets" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "presets" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "samples" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "samples" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "samples" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "samples" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "samples" ALTER COLUMN "mime_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "usage" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "usage" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "usage" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "usage" ALTER COLUMN "mixes_used" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usage" ALTER COLUMN "storage_used_mb" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_transition_usage" ADD CONSTRAINT "ai_transition_usage_user_id_usage_date_pk" PRIMARY KEY("user_id","usage_date");--> statement-breakpoint
ALTER TABLE "effect_presets" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "effect_presets" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "presets" ADD COLUMN "category" varchar(40);--> statement-breakpoint
ALTER TABLE "presets" ADD COLUMN "data" text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "presets" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "samples" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "data" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "data" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_transition_usage" ADD COLUMN "usage_date" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_transition_usage" ADD COLUMN "transition_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_transition_usage" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "ai_transition_usage_user_idx" ON "ai_transition_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_customer_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "effect_presets" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "effect_presets" DROP COLUMN "author";--> statement-breakpoint
ALTER TABLE "presets" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "presets" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "presets" DROP COLUMN "preset_data";--> statement-breakpoint
ALTER TABLE "presets" DROP COLUMN "is_factory";--> statement-breakpoint
ALTER TABLE "presets" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "samples" DROP COLUMN "file_name";--> statement-breakpoint
ALTER TABLE "samples" DROP COLUMN "file_size";--> statement-breakpoint
ALTER TABLE "samples" DROP COLUMN "duration";--> statement-breakpoint
ALTER TABLE "samples" DROP COLUMN "bpm";--> statement-breakpoint
ALTER TABLE "samples" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "samples" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "samples" DROP COLUMN "waveform_data";--> statement-breakpoint
ALTER TABLE "samples" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "bpm";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "fx";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "filter_val";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "pitch_semitones";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "recorded_events";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "bpm";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "time_signature";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "project_data";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "thumbnail_url";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "file_path";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "username";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "tier";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_admin";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "trial_started_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "trial_expires_at";--> statement-breakpoint
ALTER TABLE "usage" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "ai_transition_usage" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "ai_transition_usage" DROP COLUMN "session_id";--> statement-breakpoint
ALTER TABLE "ai_transition_usage" DROP COLUMN "used_at";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");--> statement-breakpoint
DROP TYPE "public"."agent_status";--> statement-breakpoint
DROP TYPE "public"."plugin_status";--> statement-breakpoint
DROP TYPE "public"."plugin_type";