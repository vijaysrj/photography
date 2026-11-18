"use server";

import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { endSession, requireOwner } from "@/lib/auth/session";
import { getPhoto } from "@/lib/photos";
import { newShareToken, slugify } from "@/lib/gallery";
import { deleteObjects } from "@/lib/storage";

const Id = z.uuid();
const Ids = z.array(z.uuid()).min(1).max(500);
const VisibilityValue = z.enum(["private", "unlisted", "public"]);

/** Everything visitors can see can change after any edit here. */
function refreshAll() {
  revalidatePath("/", "layout");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}

// ---------- Photos ----------

export async function deletePhoto(id: string) {
  await requireOwner();
  const photo = await getPhoto(Id.parse(id));
  if (!photo) redirect("/studio");
  const keys = [photo.originalKey, ...Object.values(photo.variants).map((v) => v!.key)];
  await deleteObjects(keys);
  await db().delete(schema.photos).where(eq(schema.photos.id, id));
  refreshAll();
  redirect("/studio");
}

export async function updatePhotoText(id: string, form: FormData) {
  await requireOwner();
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const description = String(form.get("description") ?? "").trim().slice(0, 2000);
  await db().update(schema.photos).set({ title, description, updatedAt: new Date() }).where(eq(schema.photos.id, Id.parse(id)));
  refreshAll();
}

export async function setPhotosVisibility(ids: string[], visibility: string) {
  await requireOwner();
  const v = VisibilityValue.parse(visibility);
  const list = Ids.parse(ids);
  await db().update(schema.photos).set({ visibility: v, updatedAt: new Date() }).where(inArray(schema.photos.id, list));
  if (v !== "private") {
    // Give each newly shared photo its own secret link.
    const missing = await db().select({ id: schema.photos.id }).from(schema.photos).where(and(inArray(schema.photos.id, list), isNull(schema.photos.shareToken)));
    for (const m of missing) await db().update(schema.photos).set({ shareToken: newShareToken() }).where(eq(schema.photos.id, m.id));
  }
  refreshAll();
}

export async function resetPhotoLink(id: string) {
  await requireOwner();
  await db().update(schema.photos).set({ shareToken: newShareToken(), updatedAt: new Date() }).where(eq(schema.photos.id, Id.parse(id)));
  refreshAll();
}

export async function setPhotoInAlbum(photoId: string, albumId: string, inAlbum: boolean) {
  await requireOwner();
  if (inAlbum) await addToAlbum(Id.parse(albumId), [Id.parse(photoId)]);
  else await db().delete(schema.albumPhotos).where(and(eq(schema.albumPhotos.albumId, albumId), eq(schema.albumPhotos.photoId, photoId)));
  refreshAll();
}

// ---------- Albums ----------

async function uniqueSlug(title: string, exceptId?: string) {
  const base = slugify(title);
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const [hit] = await db().select({ id: schema.albums.id }).from(schema.albums).where(eq(schema.albums.slug, slug));
    if (!hit || hit.id === exceptId) return slug;
  }
}

async function addToAlbum(albumId: string, photoIds: string[]) {
  const [{ top }] = await db().select({ top: max(schema.albumPhotos.position) }).from(schema.albumPhotos).where(eq(schema.albumPhotos.albumId, albumId));
  let pos = (top ?? -1) + 1;
  await db()
    .insert(schema.albumPhotos)
    .values(photoIds.map((photoId) => ({ albumId, photoId, position: pos++ })))
    .onConflictDoNothing();
}

export async function createAlbum(form: FormData) {
  await requireOwner();
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  if (!title) return;
  const photoIds = form.getAll("photoId").map(String).filter((s) => Id.safeParse(s).success);
  const [album] = await db().insert(schema.albums).values({ title, slug: await uniqueSlug(title) }).returning();
  if (photoIds.length) await addToAlbum(album.id, photoIds);
  refreshAll();
  if (form.get("stay") !== "1") redirect(`/studio/albums/${album.id}`);
}

export async function updateAlbumText(id: string, form: FormData) {
  await requireOwner();
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const description = String(form.get("description") ?? "").trim().slice(0, 2000);
  if (!title) return;
  await db()
    .update(schema.albums)
    .set({ title, description, slug: await uniqueSlug(title, id), updatedAt: new Date() })
    .where(eq(schema.albums.id, Id.parse(id)));
  refreshAll();
}

export async function setAlbumVisibility(id: string, visibility: string) {
  await requireOwner();
  const v = VisibilityValue.parse(visibility);
  await db()
    .update(schema.albums)
    .set({ visibility: v, shareToken: sql`coalesce(${schema.albums.shareToken}, ${newShareToken()})`, updatedAt: new Date() })
    .where(eq(schema.albums.id, Id.parse(id)));
  refreshAll();
}

export async function resetAlbumLink(id: string) {
  await requireOwner();
  await db().update(schema.albums).set({ shareToken: newShareToken(), updatedAt: new Date() }).where(eq(schema.albums.id, Id.parse(id)));
  refreshAll();
}

export async function addPhotosToAlbum(albumId: string, photoIds: string[]) {
  await requireOwner();
  await addToAlbum(Id.parse(albumId), Ids.parse(photoIds));
  refreshAll();
}

export async function removePhotoFromAlbum(albumId: string, photoId: string) {
  await requireOwner();
  await db().delete(schema.albumPhotos).where(and(eq(schema.albumPhotos.albumId, Id.parse(albumId)), eq(schema.albumPhotos.photoId, Id.parse(photoId))));
  refreshAll();
}

export async function setAlbumCover(albumId: string, photoId: string) {
  await requireOwner();
  await db().update(schema.albums).set({ coverPhotoId: Id.parse(photoId), updatedAt: new Date() }).where(eq(schema.albums.id, Id.parse(albumId)));
  refreshAll();
}

/** Moves a photo one place earlier or later in the album. */
export async function movePhotoInAlbum(albumId: string, photoId: string, direction: -1 | 1) {
  await requireOwner();
  const rows = await db()
    .select({ photoId: schema.albumPhotos.photoId })
    .from(schema.albumPhotos)
    .where(eq(schema.albumPhotos.albumId, Id.parse(albumId)))
    .orderBy(schema.albumPhotos.position, schema.albumPhotos.addedAt);
  const order = rows.map((r) => r.photoId);
  const i = order.indexOf(photoId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  await db().transaction(async (tx) => {
    for (let k = 0; k < order.length; k++) {
      await tx.update(schema.albumPhotos).set({ position: k }).where(and(eq(schema.albumPhotos.albumId, albumId), eq(schema.albumPhotos.photoId, order[k])));
    }
  });
  refreshAll();
}

export async function deleteAlbum(id: string) {
  await requireOwner();
  await db().delete(schema.albums).where(eq(schema.albums.id, Id.parse(id)));
  refreshAll();
  redirect("/studio/albums");
}
