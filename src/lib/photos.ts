import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Photo, Variant } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { signView } from "@/lib/storage";

export const VARIANT_NAMES = ["thumb", "medium", "large"] as const;
export type VariantName = (typeof VARIANT_NAMES)[number];

export function variantKey(photoId: string, name: VariantName, type: string) {
  const ext = type === "image/webp" ? "webp" : "jpg";
  return `variants/${photoId}/${name}.${ext}`;
}

export async function getUploadingPhoto(id: string): Promise<Photo> {
  const [photo] = await db()
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.id, id), eq(schema.photos.status, "uploading")));
  if (!photo || !photo.uploadId) throw new ApiError(404, "This upload no longer exists. Please start it again.");
  return photo;
}

export async function getPhoto(id: string): Promise<Photo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [photo] = await db().select().from(schema.photos).where(eq(schema.photos.id, id));
  return photo ?? null;
}

export async function listReadyPhotos(): Promise<Photo[]> {
  return db().select().from(schema.photos).where(eq(schema.photos.status, "ready")).orderBy(desc(schema.photos.createdAt));
}

export type PhotoCard = {
  id: string;
  title: string;
  width: number | null;
  height: number | null;
  color: string | null;
  visibility: Photo["visibility"];
  thumb: string | null;
  medium: string | null;
};

async function urlFor(v: Variant | undefined) {
  return v ? signView(v.key) : null;
}

export async function toCard(p: Photo): Promise<PhotoCard> {
  return {
    id: p.id,
    title: p.title,
    width: p.width,
    height: p.height,
    color: p.dominantColor,
    visibility: p.visibility,
    thumb: await urlFor(p.variants.thumb ?? p.variants.medium),
    medium: await urlFor(p.variants.medium ?? p.variants.large),
  };
}
