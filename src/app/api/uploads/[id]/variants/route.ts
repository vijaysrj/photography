import { z } from "zod";
import { body, ownerRoute } from "@/lib/api";
import { VARIANT_NAMES, getUploadingPhoto, variantKey } from "@/lib/photos";
import { signPut } from "@/lib/storage";

const Request_ = z.object({ type: z.enum(["image/webp", "image/jpeg"]) });

/** Signs upload links for the small web copies the browser made. */
export const POST = ownerRoute(async (req, ctx: RouteContext<"/api/uploads/[id]/variants">) => {
  const { id } = await ctx.params;
  const { type } = await body(req, Request_);
  await getUploadingPhoto(id);
  const urls: Record<string, string> = {};
  for (const name of VARIANT_NAMES) urls[name] = await signPut(variantKey(id, name, type), type);
  return { urls };
});
