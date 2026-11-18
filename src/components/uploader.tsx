"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelUpload, guessType, uploadPhoto, type UploadProgress } from "@/lib/upload/client";
import { ACCEPTED_TYPES } from "@/lib/upload/plan";
import { bytes } from "@/lib/format";

type Item = { id: string; file: File; progress: UploadProgress; controller: AbortController };

const accept = [...ACCEPTED_TYPES, ".heic", ".heif", ".tif", ".tiff"].join(",");

export function Uploader({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const queue = useRef<Item[]>([]);
  const running = useRef(false);

  const update = useCallback((id: string, progress: UploadProgress) => {
    setItems((all) => all.map((it) => (it.id === id ? { ...it, progress } : it)));
  }, []);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    // One photo at a time (each uses several parallel connections) keeps phones responsive.
    while (queue.current.length) {
      const item = queue.current.shift()!;
      if (item.controller.signal.aborted) continue;
      try {
        await uploadPhoto(item.file, (p) => update(item.id, p), item.controller.signal);
        router.refresh();
      } catch {
        /* the item already shows its error */
      }
    }
    running.current = false;
  }, [router, update]);

  const add = useCallback(
    (files: FileList | File[]) => {
      const fresh: Item[] = [];
      for (const file of Array.from(files)) {
        const type = file.type || guessType(file.name);
        const ok = (ACCEPTED_TYPES as readonly string[]).includes(type);
        const item: Item = {
          id: crypto.randomUUID(),
          file,
          controller: new AbortController(),
          progress: ok
            ? { phase: "preparing", sent: 0, total: file.size }
            : { phase: "error", sent: 0, total: file.size, message: "Not a supported image type" },
        };
        fresh.push(item);
        if (ok) queue.current.push(item);
      }
      setItems((all) => [...fresh, ...all]);
      void pump();
    },
    [pump],
  );

  const busy = items.some((i) => ["preparing", "uploading", "finishing"].includes(i.progress.phase));
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // Once everything has finished, tidy successful rows away so the library is back in view.
  useEffect(() => {
    if (busy || !items.some((i) => i.progress.phase === "done")) return;
    const t = setTimeout(() => setItems((all) => all.filter((i) => i.progress.phase !== "done")), 4000);
    return () => clearTimeout(t);
  }, [busy, items]);

  const cancel = (item: Item) => {
    item.controller.abort();
    queue.current = queue.current.filter((q) => q.id !== item.id);
    void cancelUpload(item.file, item.progress.photoId);
    update(item.id, { ...item.progress, phase: "cancelled", message: "Cancelled" });
  };

  const retry = (item: Item) => {
    const again = { ...item, controller: new AbortController(), progress: { ...item.progress, phase: "preparing" as const, message: undefined } };
    setItems((all) => all.map((it) => (it.id === item.id ? again : it)));
    queue.current.push(again);
    void pump();
  };

  const clearFinished = () => setItems((all) => all.filter((i) => !["done", "cancelled"].includes(i.progress.phase)));

  return (
    <section className={className}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files); }}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 text-center transition-colors duration-300 ${
          compact ? "py-6 sm:flex-row sm:justify-between sm:py-5 sm:text-left" : "py-10 sm:py-14"
        } ${
          dragging ? "border-brass bg-brass/5" : "border-line bg-ink-2/60"
        }`}
      >
        <svg aria-hidden viewBox="0 0 48 48" className={`h-10 w-10 shrink-0 text-brass ${compact ? "hidden sm:block" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="6" y="10" width="36" height="28" rx="2" />
          <path d="M6 32l10-10 8 8 6-6 12 12" />
          <circle cx="32" cy="18" r="3" />
        </svg>
        <div className={compact ? "sm:flex-1" : ""}>
          <p className="font-display text-2xl">{compact ? "Add more photographs" : "Drop photographs here"}</p>
          <p className="mt-1 text-sm text-mute">Full resolution is kept untouched. JPEG, PNG, WebP, AVIF, HEIC or TIFF, up to 2 GB each.</p>
        </div>
        <button type="button" onClick={() => input.current?.click()} className="btn bg-paper text-ink hover:bg-brass-2">
          Choose photos
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          data-testid="file-input"
          onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ""; }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-ink-2/60">
          <div className="flex items-center justify-between px-4 py-3 text-xs text-mute">
            <span>{busy ? "Uploading… you can keep browsing this page." : "Uploads"}</span>
            {!busy && <button onClick={clearFinished} className="hover:text-paper">Clear</button>}
          </div>
          <ul className="divide-y divide-line/70">
            {items.map((it) => (
              <UploadRow key={it.id} item={it} onCancel={() => cancel(it)} onRetry={() => retry(it)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function UploadRow({ item, onCancel, onRetry }: { item: Item; onCancel: () => void; onRetry: () => void }) {
  const { phase, sent, total, message, resumed } = item.progress;
  const pct = total ? Math.round((sent / total) * 100) : 0;
  const active = phase === "preparing" || phase === "uploading" || phase === "finishing";
  const label =
    phase === "preparing" ? "Preparing"
    : phase === "uploading" ? `${pct}% · ${bytes(sent)} of ${bytes(total)}${resumed ? " · resumed" : ""}`
    : phase === "finishing" ? "Finishing"
    : phase === "done" ? message ?? "Uploaded"
    : message ?? phase;

  return (
    <li className="flex items-center gap-4 px-4 py-3" data-phase={phase}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm">{item.file.name}</span>
          <span className={`shrink-0 text-xs ${phase === "error" ? "text-danger" : phase === "done" ? "text-ok" : "text-mute"}`}>{label}</span>
        </div>
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${phase === "error" ? "bg-danger" : phase === "done" ? "bg-ok" : "bg-brass"}`}
            style={{ width: `${phase === "done" ? 100 : pct}%` }}
          />
        </div>
      </div>
      {active && <button onClick={onCancel} className="text-xs text-mute hover:text-paper">Cancel</button>}
      {phase === "error" && item.progress.message !== "Not a supported image type" && (
        <button onClick={onRetry} className="text-xs text-brass hover:text-brass-2">Retry</button>
      )}
    </li>
  );
}
