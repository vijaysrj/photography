"use client";

import { useState, useTransition } from "react";
import type { PhotoCard } from "@/lib/photos";

type Props = {
  photos: PhotoCard[];
  library: PhotoCard[];
  coverId: string | null;
  onAdd: (ids: string[]) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onCover: (id: string) => Promise<void>;
  onMove: (id: string, dir: -1 | 1) => Promise<void>;
};

export function AlbumEditor({ photos, library, coverId, onAdd, onRemove, onCover, onMove }: Props) {
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const effectiveCover = coverId && photos.some((p) => p.id === coverId) ? coverId : photos[0]?.id;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-mute">{photos.length} {photos.length === 1 ? "photo" : "photos"}</p>
        <button type="button" onClick={() => setPicking(true)} disabled={library.length === 0} className="btn bg-paper text-ink hover:bg-brass-2">
          Add photos
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line px-6 py-20 text-center text-sm text-mute">
          {library.length ? "This album is empty. Add photos from your library." : "Upload photos to your library first, then add them here."}
        </div>
      ) : (
        <ol className={`mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 ${pending ? "opacity-70" : ""}`}>
          {photos.map((p, i) => (
            <li key={p.id} className="group relative overflow-hidden rounded-sm bg-ink-3" style={{ aspectRatio: "1", backgroundColor: p.color ?? undefined }}>
              {p.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumb} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
              )}
              {p.id === effectiveCover && <span className="absolute top-2 left-2 rounded-full bg-brass px-2 py-0.5 text-[0.65rem] font-medium text-ink">Cover</span>}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 text-xs opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <span className="flex gap-1">
                  <button type="button" aria-label="Move earlier" disabled={i === 0 || pending} onClick={() => start(() => onMove(p.id, -1))} className="grid h-7 w-7 place-items-center rounded-full bg-black/50 disabled:opacity-30">←</button>
                  <button type="button" aria-label="Move later" disabled={i === photos.length - 1 || pending} onClick={() => start(() => onMove(p.id, 1))} className="grid h-7 w-7 place-items-center rounded-full bg-black/50 disabled:opacity-30">→</button>
                </span>
                <span className="flex gap-1">
                  {p.id !== effectiveCover && <button type="button" disabled={pending} onClick={() => start(() => onCover(p.id))} className="rounded-full bg-black/50 px-2 py-1">Cover</button>}
                  <button type="button" disabled={pending} onClick={() => start(() => onRemove(p.id))} className="rounded-full bg-black/50 px-2 py-1 hover:text-danger">Remove</button>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {picking && (
        <div role="dialog" aria-modal="true" aria-label="Add photos" className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center sm:p-8">
          <div className="animate-rise flex max-h-[85dvh] w-full flex-col rounded-t-2xl border border-line bg-ink-2 sm:max-w-4xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="font-display text-2xl">Add from your library</p>
              <button type="button" onClick={() => { setPicking(false); setPicked(new Set()); }} className="text-sm text-mute hover:text-paper">Close</button>
            </div>
            <ul className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto p-4 sm:grid-cols-5">
              {library.map((p) => {
                const on = picked.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`Select ${p.title || "photo"}`}
                      onClick={() => { const n = new Set(picked); if (on) n.delete(p.id); else n.add(p.id); setPicked(n); }}
                      className={`relative block aspect-square w-full overflow-hidden rounded-sm ring-2 transition ${on ? "ring-brass" : "ring-transparent"}`}
                      style={{ backgroundColor: p.color ?? undefined }}
                    >
                      {p.thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumb} alt="" loading="lazy" className={`h-full w-full object-cover transition-transform ${on ? "scale-90" : ""}`} />
                      )}
                      {on && <span className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-brass text-[0.6rem] text-ink">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <span className="text-sm text-mute">{picked.size} selected</span>
              <button
                type="button"
                disabled={picked.size === 0 || pending}
                onClick={() => start(async () => { await onAdd([...picked]); setPicked(new Set()); setPicking(false); })}
                className="btn bg-paper text-ink hover:bg-brass-2"
              >
                {pending ? "Adding…" : `Add ${picked.size || ""}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
