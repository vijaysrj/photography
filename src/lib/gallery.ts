import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Album, Photo, Visibility } from "@/lib/db/schema";
import { pickVariant, viewPath } from "@/lib/view-links";

/**
 * Who can see what:
 * - private: only you, in the studio.
 * - unlisted: anyone with the secret link (/s/…), never listed or indexed.
 * - public: listed on the site.
 * Anyone who can open an album can see every photo in it: adding a photo to a
 * shared album is how you share it.
 */

export type GalleryPhoto = {
  id: string;
  title: string;
  description: string;
  width: number;
  height: number;
  color: string | null;
  thumb: string;
  medium: string;
  large: string;
  takenAt: string | null;
  camera: string | null;
};

export type AlbumCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: Visibility;
  shareToken: string | null;
  count: number;
  cover: { url: string; color: string | null; width: number; height: number } | null;
};

export const newShareToken = () => randomBytes(16).toString("base64url");

export function cameraLine(p: Photo): string | null {
  const e = p.exif;
  const body = e.make && e.model && !e.model.startsWith(e.make) ? `${e.make} ${e.model}` : (e.model ?? e.make);
  return [body, e.lens].filter(Boolean).join(" · ") || null;
}

/** Only photos with web copies can be shown in galleries. */
function showable(p: Photo) {
  return p.status === "ready" && !!(p.variants.thumb || p.variants.medium || p.variants.large);
}

export function toGalleryPhoto(p: Photo): GalleryPhoto {
  const large = (p.variants.large ?? p.variants.medium ?? p.variants.thumb)!;
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    width: large.width,
    height: large.height,
    color: p.dominantColor,
    thumb: viewPath(p, "thumb"),
    medium: viewPath(p, "medium"),
    large: viewPath(p, "large"),
    takenAt: p.takenAt?.toISOString() ?? null,
    camera: cameraLine(p),
  };
}

export const toGalleryPhotos = async (ps: Photo[]) => ps.filter(showable).map(toGalleryPhoto);

const newestFirst = [desc(schema.photos.takenAt), desc(schema.photos.createdAt)];

export async function publicPhotos(): Promise<Photo[]> {
  return db()
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.status, "ready"), eq(schema.photos.visibility, "public")))
    .orderBy(...newestFirst);
}

export async function publicPhoto(id: string): Promise<Photo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await db()
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.id, id), eq(schema.photos.visibility, "public"), eq(schema.photos.status, "ready")));
  return p ?? null;
}

export async function albumPhotos(albumId: string): Promise<Photo[]> {
  const rows = await db()
    .select({ photo: schema.photos })
    .from(schema.albumPhotos)
    .innerJoin(schema.photos, eq(schema.albumPhotos.photoId, schema.photos.id))
    .where(and(eq(schema.albumPhotos.albumId, albumId), eq(schema.photos.status, "ready")))
    .orderBy(asc(schema.albumPhotos.position), asc(schema.albumPhotos.addedAt));
  return rows.map((r) => r.photo);
}

async function toAlbumCards(albums: Album[]): Promise<AlbumCard[]> {
  if (albums.length === 0) return [];
  const ids = albums.map((a) => a.id);
  const counts = await db()
    .select({ albumId: schema.albumPhotos.albumId, n: count() })
    .from(schema.albumPhotos)
    .innerJoin(schema.photos, eq(schema.albumPhotos.photoId, schema.photos.id))
    .where(and(inArray(schema.albumPhotos.albumId, ids), eq(schema.photos.status, "ready")))
    .groupBy(schema.albumPhotos.albumId);
  // Cover: the chosen one, else the album's first photo.
  const firsts = await db()
    .select({ albumId: schema.albumPhotos.albumId, photo: schema.photos })
    .from(schema.albumPhotos)
    .innerJoin(schema.photos, eq(schema.albumPhotos.photoId, schema.photos.id))
    .where(and(inArray(schema.albumPhotos.albumId, ids), eq(schema.photos.status, "ready")))
    .orderBy(asc(schema.albumPhotos.position), asc(schema.albumPhotos.addedAt));
  const byAlbum = new Map<string, Photo[]>();
  for (const f of firsts) byAlbum.set(f.albumId, [...(byAlbum.get(f.albumId) ?? []), f.photo]);

  return Promise.all(
    albums.map(async (a) => {
      const inAlbum = byAlbum.get(a.id) ?? [];
      const coverPhoto = (inAlbum.find((p) => p.id === a.coverPhotoId) ?? inAlbum[0]) as Photo | undefined;
      const v = coverPhoto ? pickVariant(coverPhoto, "medium") : undefined;
      return {
        id: a.id,
        slug: a.slug,
        title: a.title,
        description: a.description,
        visibility: a.visibility,
        shareToken: a.shareToken,
        count: counts.find((c) => c.albumId === a.id)?.n ?? 0,
        cover: v && coverPhoto ? { url: viewPath(coverPhoto, "medium"), color: coverPhoto.dominantColor, width: v.width, height: v.height } : null,
      };
    }),
  );
}

export async function publicAlbums(): Promise<AlbumCard[]> {
  const rows = await db().select().from(schema.albums).where(eq(schema.albums.visibility, "public")).orderBy(desc(schema.albums.createdAt));
  return (await toAlbumCards(rows)).filter((a) => a.count > 0);
}

export async function allAlbums(): Promise<AlbumCard[]> {
  return toAlbumCards(await db().select().from(schema.albums).orderBy(desc(schema.albums.createdAt)));
}

export async function publicAlbumBySlug(slug: string): Promise<Album | null> {
  const [a] = await db().select().from(schema.albums).where(and(eq(schema.albums.slug, slug), eq(schema.albums.visibility, "public")));
  return a ?? null;
}

export async function albumById(id: string): Promise<Album | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [a] = await db().select().from(schema.albums).where(eq(schema.albums.id, id));
  return a ?? null;
}

/** Resolves a secret share link. Private items are never returned, even with a valid token. */
export async function resolveShareToken(token: string): Promise<{ kind: "album"; album: Album } | { kind: "photo"; photo: Photo } | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [album] = await db()
    .select()
    .from(schema.albums)
    .where(and(eq(schema.albums.shareToken, token), ne(schema.albums.visibility, "private")));
  if (album) return { kind: "album", album };
  const [photo] = await db()
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.shareToken, token), ne(schema.photos.visibility, "private"), eq(schema.photos.status, "ready")));
  return photo ? { kind: "photo", photo } : null;
}

export async function albumIdsForPhoto(photoId: string): Promise<string[]> {
  const rows = await db().select({ id: schema.albumPhotos.albumId }).from(schema.albumPhotos).where(eq(schema.albumPhotos.photoId, photoId));
  return rows.map((r) => r.id);
}

export { sharePath, slugify } from "./share";
