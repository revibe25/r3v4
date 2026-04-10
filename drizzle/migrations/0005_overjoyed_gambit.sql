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
ALTER TABLE "midi_mappings" DROP COLUMN "is_admin";--> statement-breakpoint
ALTER TABLE "presets" DROP COLUMN "is_admin";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "is_admin";--> statement-breakpoint
ALTER TABLE "samples" DROP COLUMN "is_admin";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "is_admin";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "is_admin";--> statement-breakpoint
ALTER TABLE "usage" DROP COLUMN "is_admin";