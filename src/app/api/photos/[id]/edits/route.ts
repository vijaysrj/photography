import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import type { Variants } from "@/lib/db/schema";
import { ApiError, body, ownerRoute } from "@/lib/api";
import { VARIANT_NAMES, getPhoto, variantKey } from "@/lib/photos";
import { deleteObjects, objectSize } from "@/lib/storage";
import { EditsSchema } from "@/lib/edit/schema";
import { isIdentity, sanitizeEdits, type Edits } from "@/lib/edit/types";

const VariantInfo = z.object({ width: z.number().int().positive(), height: z.number().int().positive() });

const Commit = z.object({
  version: z.number().int().positive(),
  type: z.enum(["image/webp", "image/jpeg"]),
  // Tidy rounding errors before checking, rather than refusing the save.
  edits: z.preprocess((v) => (v && typeof v === "object" ? sanitizeEdits(v as Edits) : v), EditsSchema.nullable()),
  dominantColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullish(),
  variants: z.object({ thumb: VariantInfo, medium: VariantInfo, large: VariantInfo }),
});

/** Switches the photo to its newly edited web copies, then removes the old ones. */
export const POST = ownerRoute(async (req, ctx: RouteContext<"/api/photos/[id]/edits">) => {
  const { id } = await ctx.params;
  const input = await body(req, Commit);
  const photo = await getPhoto(id);
  if (!photo || photo.status !== "ready") throw new ApiError(404, "Photo not found");
  if (input.version !== photo.editVersion + 1) throw new ApiError(409, "This photo was edited somewhere else. Reload and try again.");

  // Keep the unedited large copy as the editor's starting point.
  const base = photo.variants.base ?? (photo.editVersion === 0 ? photo.variants.large : undefined);
  const variants: Variants = base ? { base } : {};
  for (const name of VARIANT_NAMES) {
    const key = variantKey(id, name, input.type, input.version);
    const bytes = await objectSize(key);
    if (!bytes) throw new ApiError(400, "The edited images didn't finish uploading. Please try again.");
    variants[name] = { key, ...input.variants[name], bytes, type: input.type };
  }

  const updated = await db()
    .update(schema.photos)
    .set({
      variants,
      edits: isIdentity(input.edits) ? null : input.edits,
      editVersion: input.version,
      dominantColor: input.dominantColor ?? photo.dominantColor,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.photos.id, id), eq(schema.photos.editVersion, photo.editVersion)))
    .returning({ id: schema.photos.id });
  if (!updated.length) throw new ApiError(409, "This photo was edited somewhere else. Reload and try again.");

  const fresh = new Set(Object.values(variants).map((v) => v!.key));
  await deleteObjects(Object.values(photo.variants).map((v) => v!.key).filter((k) => !fresh.has(k))).catch(() => {});
  revalidatePath("/", "layout");
  return { ok: true };
});
