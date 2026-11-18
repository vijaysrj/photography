import { z } from "zod";
import { db, schema } from "@/lib/db";
import { ApiError, body, ownerRoute } from "@/lib/api";
import { createMultipartUpload } from "@/lib/storage";
import { ACCEPTED_TYPES, MAX_FILE_SIZE, choosePartSize, partCount, safeFileName, titleFromFileName } from "@/lib/upload/plan";

const Start = z.object({
  name: z.string().min(1).max(300),
  type: z.string().max(100),
  size: z.number().int().positive(),
});

/** Starts an upload: records the photo and opens a multipart upload in R2. */
export const POST = ownerRoute(async (req) => {
  const input = await body(req, Start);
  if (input.size > MAX_FILE_SIZE) throw new ApiError(413, "That file is larger than 2 GB.");
  const type = input.type || "application/octet-stream";
  if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) {
    throw new ApiError(415, "Please upload a JPEG, PNG, WebP, AVIF, HEIC or TIFF image.");
  }

  const id = crypto.randomUUID();
  const originalKey = `originals/${id}/${safeFileName(input.name)}`;
  const partSize = choosePartSize(input.size);
  const uploadId = await createMultipartUpload(originalKey, type);

  await db().insert(schema.photos).values({
    id,
    title: titleFromFileName(input.name),
    originalKey,
    originalName: input.name,
    mimeType: type,
    sizeBytes: input.size,
    uploadId,
    partSize,
  });

  return { photoId: id, partSize, partCount: partCount(input.size, partSize) };
});
