import { makeVariants, readCameraInfo } from "./images";
import { partRange } from "./plan";

/**
 * Browser-side upload engine.
 * - Sends the original straight to R2 in parts, 4 at a time, retrying each part.
 * - Remembers progress, so picking the same file again after a dropped connection
 *   or closed tab carries on instead of starting over.
 * - Makes and uploads web-sized copies alongside.
 */

export type UploadPhase = "preparing" | "uploading" | "finishing" | "done" | "error" | "cancelled";
export type UploadProgress = { phase: UploadPhase; sent: number; total: number; message?: string; photoId?: string; resumed?: boolean };

const CONCURRENCY = 4;
const MAX_ATTEMPTS = 6;
const SIGN_BATCH = 8;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

const memoryKey = (f: File) => `upload:v1:${f.name}:${f.size}:${f.lastModified}`;
function remember(f: File, photoId: string) {
  try { localStorage.setItem(memoryKey(f), photoId); } catch {}
}
function recall(f: File): string | null {
  try { return localStorage.getItem(memoryKey(f)); } catch { return null; }
}
function forget(f: File) {
  try { localStorage.removeItem(memoryKey(f)); } catch {}
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });

/** PUT with byte-level progress. Returns the ETag R2 assigns to the part. */
function putWithProgress(url: string, data: Blob, onBytes: (n: number) => void, signal: AbortSignal, contentType?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    let last = 0;
    xhr.upload.onprogress = (e) => { onBytes(e.loaded - last); last = e.loaded; };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.getResponseHeader("ETag") ?? "");
      else { onBytes(-last); reject(new HttpError(xhr.status, `Storage refused the upload (${xhr.status})`)); }
    };
    xhr.onerror = () => { onBytes(-last); reject(new Error("Network problem")); };
    const abort = () => { xhr.abort(); onBytes(-last); reject(new DOMException("Aborted", "AbortError")); };
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.send(data);
  });
}

async function withRetry<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (signal.aborted || attempt >= MAX_ATTEMPTS) throw err;
      if (err instanceof HttpError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) throw err;
      await sleep(Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.random() * 500, signal);
    }
  }
}

type Session = { photoId: string; partSize: number; partCount: number; done: Map<number, string>; resumed: boolean };

async function openSession(file: File): Promise<Session> {
  const existing = recall(file);
  if (existing) {
    try {
      const r = await api<{ parts: { partNumber: number; etag: string; size: number }[]; partSize: number; partCount: number }>(
        `/api/uploads/${existing}/parts`,
      );
      const done = new Map<number, string>();
      for (const p of r.parts) {
        const { start, end } = partRange(p.partNumber, r.partSize, file.size);
        if (p.size === end - start) done.set(p.partNumber, p.etag);
      }
      return { photoId: existing, partSize: r.partSize, partCount: r.partCount, done, resumed: true };
    } catch {
      forget(file);
    }
  }
  const r = await api<{ photoId: string; partSize: number; partCount: number }>("/api/uploads", {
    method: "POST",
    body: JSON.stringify({ name: file.name, type: file.type || guessType(file.name), size: file.size }),
  });
  remember(file, r.photoId);
  return { ...r, done: new Map(), resumed: false };
}

export function guessType(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif",
    heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff" } as Record<string, string>)[ext] ?? "";
}

export async function uploadPhoto(file: File, onProgress: (p: UploadProgress) => void, signal: AbortSignal): Promise<string> {
  // Progress counts bytes of the original; the web copies are small and ride along.
  const total = file.size;
  let sent = 0;
  let phase: UploadPhase = "preparing";
  const ids: { photoId?: string; resumed?: boolean } = {};
  const report = (message?: string) => onProgress({ phase, sent: Math.max(0, Math.min(sent, total)), total, message, ...ids });
  report();

  const session = await openSession(file);
  ids.photoId = session.photoId;
  ids.resumed = session.resumed;
  for (const n of session.done.keys()) {
    const { start, end } = partRange(n, session.partSize, file.size);
    sent += end - start;
  }
  phase = "uploading";
  report();

  // Start making web copies while the original uploads.
  const extras = (async () => {
    const [info, camera] = await Promise.all([makeVariants(file), readCameraInfo(file)]);
    if (!info) return { info: null, camera };
    const { urls } = await api<{ urls: Record<string, string> }>(`/api/uploads/${session.photoId}/variants`, {
      method: "POST",
      body: JSON.stringify({ type: info.type }),
    });
    for (const v of info.variants) {
      await withRetry(() => putWithProgress(urls[v.name], v.blob, () => {}, signal, info.type), signal);
    }
    return { info, camera };
  })();

  const todo = Array.from({ length: session.partCount }, (_, i) => i + 1).filter((n) => !session.done.has(n));
  const signed = new Map<number, string>();
  const sign = async (n: number) => {
    if (!signed.has(n)) {
      const batch = todo.filter((m) => m >= n && !signed.has(m)).slice(0, SIGN_BATCH);
      const { urls } = await api<{ urls: Record<string, string> }>(`/api/uploads/${session.photoId}/parts`, {
        method: "POST",
        body: JSON.stringify({ partNumbers: batch }),
      });
      for (const [k, v] of Object.entries(urls)) signed.set(Number(k), v);
    }
    return signed.get(n)!;
  };

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const n = todo[next++];
      const { start, end } = partRange(n, session.partSize, file.size);
      const etag = await withRetry(async () => {
        const url = await sign(n);
        try {
          return await putWithProgress(url, file.slice(start, end), (d) => { sent += d; report(); }, signal);
        } catch (err) {
          if (err instanceof HttpError && err.status === 403) signed.delete(n); // link expired: re-sign
          throw err;
        }
      }, signal);
      if (!etag) throw new Error("Storage didn't confirm a part. Check the bucket's CORS settings expose ETag.");
      session.done.set(n, etag);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
    phase = "finishing";
    report();
    const { info, camera } = await extras.catch(() => ({ info: null, camera: { exif: {} } as Awaited<ReturnType<typeof readCameraInfo>> }));
    await withRetry(
      () =>
        api(`/api/uploads/${session.photoId}/complete`, {
          method: "POST",
          body: JSON.stringify({
            parts: [...session.done].map(([partNumber, etag]) => ({ partNumber, etag })),
            width: info?.width,
            height: info?.height,
            dominantColor: info?.dominantColor,
            takenAt: camera.takenAt,
            exif: camera.exif,
            variants: Object.fromEntries((info?.variants ?? []).map((v) => [v.name, { width: v.width, height: v.height, type: info!.type }])),
          }),
        }),
      signal,
    );
    forget(file);
    phase = "done";
    sent = total;
    report(info ? undefined : "Uploaded. This browser can't preview this format, so it has no thumbnail yet.");
    return session.photoId;
  } catch (err) {
    if (signal.aborted) {
      phase = "cancelled";
      report("Cancelled");
    } else {
      phase = "error";
      report(err instanceof Error ? err.message : "Upload failed");
    }
    throw err;
  }
}

/** Throws away an unfinished upload on the server too. */
export async function cancelUpload(file: File, photoId?: string) {
  const id = photoId ?? recall(file);
  forget(file);
  if (id) await fetch(`/api/uploads/${id}`, { method: "DELETE" }).catch(() => {});
}
