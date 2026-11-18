"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { endSession, requireOwner } from "@/lib/auth/session";
import { getPhoto } from "@/lib/photos";
import { deleteObjects } from "@/lib/storage";

export async function signOut() {
  await endSession();
  redirect("/login");
}

export async function deletePhoto(id: string) {
  await requireOwner();
  const photo = await getPhoto(id);
  if (!photo) redirect("/studio");
  const keys = [photo.originalKey, ...Object.values(photo.variants).map((v) => v!.key)];
  await deleteObjects(keys);
  await db().delete(schema.photos).where(eq(schema.photos.id, id));
  revalidatePath("/studio");
  redirect("/studio");
}

export async function renamePhoto(id: string, form: FormData) {
  await requireOwner();
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  await db().update(schema.photos).set({ title, updatedAt: new Date() }).where(eq(schema.photos.id, id));
  revalidatePath(`/studio/photos/${id}`);
  revalidatePath("/studio");
}
