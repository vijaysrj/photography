import { z } from "zod";
import { ApiError, body, ownerRoute } from "@/lib/api";
import { VARIANT_NAMES, getPhoto, variantKey } from "@/lib/photos";
import { signPut } from "@/lib/storage";

const Prepare = z.object({ type: z.enum(["image/webp", "image/jpeg"]) });

/** Hands the editor upload links for a new set of web copies. The live ones stay until the save completes. */
export const POST = ownerRoute(async (req, ctx: RouteContext<"/api/photos/[id]/edits/prepare">) => {
  const { id } = await ctx.params;
  const { type } = await body(req, Prepare);
  const photo = await getPhoto(id);
  if (!photo || photo.status !== "ready") throw new ApiError(404, "Photo not found");
  const version = photo.editVersion + 1;
  const urls: Record<string, string> = {};
  for (const name of VARIANT_NAMES) urls[name] = await signPut(variantKey(id, name, type, version), type);
  return { version, urls };
});
