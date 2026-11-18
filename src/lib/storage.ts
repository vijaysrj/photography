import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

/**
 * Cloudflare R2 speaks the S3 API, so we use the AWS SDK pointed at R2.
 * Files never pass through our server: the browser uploads straight to R2
 * using short-lived signed links that this module creates.
 */

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    const e = env();
    client = new S3Client({
      region: "auto",
      endpoint: e.r2Endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
      // R2 does not support the newer default checksum headers on presigned uploads.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

const bucket = () => env().R2_BUCKET;
const UPLOAD_LINK_TTL = 60 * 60; // 1 hour per signed part link

export async function createMultipartUpload(key: string, contentType: string): Promise<string> {
  const res = await s3().send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: contentType }));
  if (!res.UploadId) throw new Error("Storage did not return an upload id");
  return res.UploadId;
}

export function signUploadPart(key: string, uploadId: string, partNumber: number): Promise<string> {
  return getSignedUrl(s3(), new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber }), {
    expiresIn: UPLOAD_LINK_TTL,
  });
}

export async function listUploadedParts(key: string, uploadId: string): Promise<{ partNumber: number; etag: string; size: number }[]> {
  const parts: { partNumber: number; etag: string; size: number }[] = [];
  let marker: string | undefined;
  do {
    const res = await s3().send(new ListPartsCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumberMarker: marker }));
    for (const p of res.Parts ?? []) {
      if (p.PartNumber && p.ETag) parts.push({ partNumber: p.PartNumber, etag: p.ETag, size: p.Size ?? 0 });
    }
    marker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
  } while (marker);
  return parts;
}

export async function completeMultipartUpload(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: sorted.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    }),
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }));
}

export function signPut(key: string, contentType: string): Promise<string> {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_LINK_TTL,
  });
}

export async function objectSize(key: string): Promise<number | null> {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return res.ContentLength ?? null;
  } catch {
    return null;
  }
}

/**
 * Signed view links are made from a fixed time window rather than "now", so the
 * same photo gets the same link for hours. That lets browsers cache images
 * instead of downloading them again on every visit (fewer R2 reads, faster pages).
 */
const VIEW_WINDOW_SECONDS = 6 * 60 * 60;
const VIEW_TTL_SECONDS = 12 * 60 * 60;

export function signView(key: string, opts: { downloadName?: string } = {}): Promise<string> {
  const windowStart = Math.floor(Date.now() / 1000 / VIEW_WINDOW_SECONDS) * VIEW_WINDOW_SECONDS;
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: opts.downloadName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}`
        : undefined,
      ResponseCacheControl: opts.downloadName ? undefined : "private, max-age=21600, immutable",
    }),
    { expiresIn: VIEW_TTL_SECONDS, signingDate: new Date(windowStart * 1000) },
  );
}

export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return;
  await s3().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));
}
