CREATE TABLE "album_photos" (
	"album_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "album_photos_album_id_photo_id_pk" PRIMARY KEY("album_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" "photo_visibility" DEFAULT 'private' NOT NULL,
	"share_token" text,
	"cover_photo_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "album_photos" ADD CONSTRAINT "album_photos_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_photos" ADD CONSTRAINT "album_photos_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_cover_photo_id_photos_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "album_photos_photo_idx" ON "album_photos" USING btree ("photo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "albums_slug_idx" ON "albums" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "albums_share_token_idx" ON "albums" USING btree ("share_token");--> statement-breakpoint
CREATE UNIQUE INDEX "photos_share_token_idx" ON "photos" USING btree ("share_token");