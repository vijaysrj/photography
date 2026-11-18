/**
 * Shared rules for splitting big files into parts. R2 requires every part except
 * the last to be the same size and at least 5 MB, and allows at most 10,000 parts.
 */
export const MIN_PART_SIZE = 5 * 1024 * 1024;
export const DEFAULT_PART_SIZE = 16 * 1024 * 1024;
export const MAX_PARTS = 10_000;
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB per photo is plenty

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif", "image/tiff"] as const;

export function choosePartSize(fileSize: number): number {
  let size = DEFAULT_PART_SIZE;
  while (Math.ceil(fileSize / size) > MAX_PARTS) size *= 2;
  return Math.max(size, MIN_PART_SIZE);
}

export function partCount(fileSize: number, partSize: number): number {
  return Math.max(1, Math.ceil(fileSize / partSize));
}

export function partRange(partNumber: number, partSize: number, fileSize: number): { start: number; end: number } {
  const start = (partNumber - 1) * partSize;
  return { start, end: Math.min(start + partSize, fileSize) };
}

/** Keeps letters, numbers, dots, dashes and underscores so storage keys stay tidy. */
export function safeFileName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return (cleaned || "photo").slice(-120);
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ").trim();
}
