import { bigint, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";

export const photoStatus = pgEnum("photo_status", ["uploading", "ready", "failed"]);
export const photoVisibility = pgEnum("photo_visibility", ["private", "unlisted", "public"]);

/** A web-sized copy generated in the browser at upload time. */
export type Variant = { key: string; width: number; height: number; bytes: number; type: string };
export type Variants = { thumb?: Variant; medium?: Variant; large?: Variant };

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
    takenAt: timestamp("taken_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photos_created_at_idx").on(t.createdAt), index("photos_status_idx").on(t.status)],
);

export type Photo = typeof photos.$inferSelect;
