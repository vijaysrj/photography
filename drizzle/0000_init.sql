CREATE TYPE "public"."photo_status" AS ENUM('uploading', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."photo_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "photo_status" DEFAULT 'uploading' NOT NULL,
	"visibility" "photo_visibility" DEFAULT 'private' NOT NULL,
	"original_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"upload_id" text,
	"part_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"dominant_color" text,
	"variants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"exif" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"taken_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "photos_created_at_idx" ON "photos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "photos_status_idx" ON "photos" USING btree ("status");