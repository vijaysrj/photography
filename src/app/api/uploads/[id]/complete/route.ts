import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import type { Variants } from "@/lib/db/schema";
import { ApiError, body, ownerRoute } from "@/lib/api";
import { VARIANT_NAMES, getUploadingPhoto, variantKey } from "@/lib/photos";
import { completeMultipartUpload, objectSize } from "@/lib/storage";
import { partCount } from "@/lib/upload/plan";

const VariantInfo = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  type: z.enum(["image/webp", "image/jpeg"]),
});

const Complete = z.object({
  parts: z.array(z.object({ partNumber: z.number().int().min(1), etag: z.string().min(1).max(200) })).min(1),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  dominantColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullish(),
  takenAt: z.iso.datetime({ offset: true }).nullish(),
  exif: z
    .object({
      make: z.string().max(100).optional(),
      model: z.string().max(100).optional(),
      lens: z.string().max(200).optional(),
      focalLength: z.number().optional(),
      aperture: z.number().optional(),
      exposureTime: z.number().optional(),
      iso: z.number().optional(),
    })
    .default({}),
  variants: z.object({ thumb: VariantInfo.optional(), medium: VariantInfo.optional(), large: VariantInfo.optional() }).default({}),
});

/** Finishes the upload: joins the parts in R2 and marks the photo ready. */
export const POST = ownerRoute(async (req, ctx: RouteContext<"/api/uploads/[id]/complete">) => {
  const { id } = await ctx.params;
  const input = await body(req, Complete);
  const photo = await getUploadingPhoto(id);

  const expected = partCount(photo.sizeBytes, photo.partSize);
  const numbers = new Set(input.parts.map((p) => p.partNumber));
  if (numbers.size !== expected || input.parts.some((p) => p.partNumber > expected)) {
    throw new ApiError(400, `Expected ${expected} parts but received ${numbers.size}.`);
  }

  await completeMultipartUpload(photo.originalKey, photo.uploadId!, input.parts);

  // Only record web copies that really arrived in storage.
  const variants: Variants = {};
  for (const name of VARIANT_NAMES) {
    const info = input.variants[name];
    if (!info) continue;
    const key = variantKey(id, name, info.type);
    const bytes = await objectSize(key);
    if (bytes) variants[name] = { key, width: info.width, height: info.height, bytes, type: info.type };
  }

  await db()
    .update(schema.photos)
    .set({
      status: "ready",
      uploadId: null,
      width: input.width ?? null,
      height: input.height ?? null,
      dominantColor: input.dominantColor ?? null,
      takenAt: input.takenAt ? new Date(input.takenAt) : null,
      exif: input.exif,
      variants,
      updatedAt: new Date(),
    })
    .where(eq(schema.photos.id, id));

  return { photoId: id, previews: Object.keys(variants).length };
});
