import type { Edits } from "@/lib/edit/types";
import { bigint, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";

export const photoStatus = pgEnum("photo_status", ["uploading", "ready", "failed"]);
export const photoVisibility = pgEnum("photo_visibility", ["private", "unlisted", "public"]);

/** A web-sized copy generated in the browser at upload time. */
export type Variant = { key: string; width: number; height: number; bytes: number; type: string };
/** `base` keeps the unedited large copy once a photo has been edited, so the editor can start from it. */
export type Variants = { thumb?: Variant; medium?: Variant; large?: Variant; base?: Variant };

/** Camera details read from the file. GPS is deliberately never stored. */
export type PhotoExif = {
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number;
  exposureTime?: number;
  iso?: number;
};

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    status: photoStatus("status").notNull().default("uploading"),
    visibility: photoVisibility("visibility").notNull().default("private"),
    /** Secret part of the "anyone with the link" address. Created the first time you share. */
    shareToken: text("share_token"),

    originalKey: text("original_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    uploadId: text("upload_id"),
    partSize: integer("part_size").notNull(),

    width: integer("width"),
    height: integer("height"),
    dominantColor: text("dominant_color"),
    variants: jsonb("variants").$type<Variants>().notNull().default({}),
    exif: jsonb("exif").$type<PhotoExif>().notNull().default({}),
    /** Non-destructive edit recipe; null means shown as shot. */
    edits: jsonb("edits").$type<Edits>(),
    /** Bumped on every save, so edited web copies get fresh addresses (no stale caches). */
    editVersion: integer("edit_version").notNull().default(0),
    takenAt: timestamp("taken_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("photos_created_at_idx").on(t.createdAt),
    index("photos_status_idx").on(t.status),
    uniqueIndex("photos_share_token_idx").on(t.shareToken),
  ],
);

export type Photo = typeof photos.$inferSelect;
export type Visibility = Photo["visibility"];

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    visibility: photoVisibility("visibility").notNull().default("private"),
    shareToken: text("share_token"),
    coverPhotoId: uuid("cover_photo_id").references(() => photos.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("albums_slug_idx").on(t.slug), uniqueIndex("albums_share_token_idx").on(t.shareToken)],
);

export type Album = typeof albums.$inferSelect;

export const albumPhotos = pgTable(
  "album_photos",
  {
    albumId: uuid("album_id").notNull().references(() => albums.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.albumId, t.photoId] }), index("album_photos_photo_idx").on(t.photoId)],
);
