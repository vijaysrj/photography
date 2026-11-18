import { z } from "zod";
import { ApiError, body, ownerRoute } from "@/lib/api";
import { getUploadingPhoto } from "@/lib/photos";
import { listUploadedParts, signUploadPart } from "@/lib/storage";
import { partCount } from "@/lib/upload/plan";

/** Lists the parts R2 already has, so an interrupted upload can carry on where it stopped. */
export const GET = ownerRoute(async (_req, ctx: RouteContext<"/api/uploads/[id]/parts">) => {
  const { id } = await ctx.params;
  const photo = await getUploadingPhoto(id);
  const parts = await listUploadedParts(photo.originalKey, photo.uploadId!);
  return { parts, partSize: photo.partSize, partCount: partCount(photo.sizeBytes, photo.partSize) };
});

const Sign = z.object({ partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(50) });

/** Signs upload links for a batch of parts. */
export const POST = ownerRoute(async (req, ctx: RouteContext<"/api/uploads/[id]/parts">) => {
  const { id } = await ctx.params;
  const { partNumbers } = await body(req, Sign);
  const photo = await getUploadingPhoto(id);
  const total = partCount(photo.sizeBytes, photo.partSize);
  if (partNumbers.some((n) => n > total)) throw new ApiError(400, "Part number out of range");
  const urls: Record<number, string> = {};
  await Promise.all(partNumbers.map(async (n) => (urls[n] = await signUploadPart(photo.originalKey, photo.uploadId!, n))));
  return { urls };
});
