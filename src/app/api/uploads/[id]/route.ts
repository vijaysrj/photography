import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ownerRoute } from "@/lib/api";
import { getUploadingPhoto } from "@/lib/photos";
import { abortMultipartUpload, deleteObjects } from "@/lib/storage";

/** Cancels an unfinished upload and cleans up anything already sent. */
export const DELETE = ownerRoute(async (_req, ctx: RouteContext<"/api/uploads/[id]">) => {
  const { id } = await ctx.params;
  const photo = await getUploadingPhoto(id);
  await abortMultipartUpload(photo.originalKey, photo.uploadId!).catch(() => {});
  await deleteObjects([`variants/${id}/thumb.webp`, `variants/${id}/medium.webp`, `variants/${id}/large.webp`,
    `variants/${id}/thumb.jpg`, `variants/${id}/medium.jpg`, `variants/${id}/large.jpg`]).catch(() => {});
  await db().delete(schema.photos).where(eq(schema.photos.id, id));
});
