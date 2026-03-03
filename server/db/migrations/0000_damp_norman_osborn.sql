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
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"chain" text NOT NULL,
	"tags" text[],
	"is_premium" boolean DEFAULT false,
	"author" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"bpm" integer DEFAULT 120 NOT NULL,
	"time_signature" text DEFAULT '4/4' NOT NULL,
	"key" text,
	"project_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thumbnail_url" text,
	"file_path" text,
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
	"user_id" varchar,
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
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"tier" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
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
CREATE INDEX "midi_mappings_user_id_idx" ON "midi_mappings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presets_user_id_idx" ON "presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "presets_type_idx" ON "presets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "samples_user_id_idx" ON "samples" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");