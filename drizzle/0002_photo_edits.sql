ALTER TABLE "photos" ADD COLUMN "edits" jsonb;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "edit_version" integer DEFAULT 0 NOT NULL;