"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { PhotoCard } from "@/lib/photos";
import type { Visibility } from "@/lib/db/schema";

const BADGE: Record<Visibility, string | null> = { private: null, unlisted: "Link", public: "Public" };

type BulkActions = {
  setVisibility: (ids: string[], v: Visibility) => Promise<void>;
  addToAlbum: (albumId: string, ids: string[]) => Promise<void>;
  newAlbum: (form: FormData) => Promise<void>;
};

/** Masonry grid that keeps each photo's real shape. With `bulk`, you can select many and act on them. */
export function PhotoGrid({
  photos,
  className = "",
  albums = [],
  bulk,
}: {
  photos: PhotoCard[];
  className?: string;
  albums?: { id: string; title: string }[];
  bulk?: BulkActions;
}) {
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  if (photos.length === 0) return null;

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const done = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); done(); });
  const ids = [...picked];

  return (
    <section className={className}>
      {bulk && (
        <div className="mb-4 flex items-center justify-end gap-3 text-sm">
          {selecting && (
            <button onClick={() => setPicked(picked.size === photos.length ? new Set() : new Set(photos.map((p) => p.id)))} className="text-mute hover:text-paper">
              {picked.size === photos.length ? "Select none" : "Select all"}
            </button>
          )}
          <button onClick={() => (selecting ? done() : setSelecting(true))} className="rounded-full border border-line px-4 py-1.5 hover:border-brass">
            {selecting ? "Done" : "Select"}
          </button>
        </div>
      )}

      <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
        {photos.map((p, i) => {
          const isPicked = picked.has(p.id);
          const tile = (
            <>
              {p.thumb ? (
                // Signed R2 links are already sized for the grid, so a plain img is cheaper than image optimisation.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumb}
                  srcSet={p.medium && p.medium !== p.thumb ? `${p.thumb} 480w, ${p.medium} 1280w` : undefined}
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  alt={p.title}
                  loading={i < 8 ? "eager" : "lazy"}
                  decoding="async"
                  className={`h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-gallery)] ${selecting ? (isPicked ? "scale-[0.92]" : "") : "group-hover:scale-[1.03]"}`}
                />
              ) : (
                <span className="grid h-full w-full place-items-center p-4 text-center text-xs text-mute">No preview yet</span>
              )}
              {BADGE[p.visibility] && (
                <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[0.65rem] tracking-wide text-paper/90 backdrop-blur">{BADGE[p.visibility]}</span>
              )}
              {selecting && (
                <span className={`absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full border text-xs ${isPicked ? "border-brass bg-brass text-ink" : "border-paper/70 bg-black/30"}`}>
                  {isPicked ? "✓" : ""}
                </span>
              )}
              {!selecting && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-sm opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="block truncate">{p.title || "Untitled"}</span>
                </span>
              )}
            </>
          );
          const style = { aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : "4 / 5", backgroundColor: p.color ?? undefined };
          return (
            <li key={p.id} className="animate-rise mb-3 break-inside-avoid sm:mb-4" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              {selecting ? (
                <button type="button" aria-pressed={isPicked} aria-label={`Select ${p.title || "photo"}`} onClick={() => toggle(p.id)} className="group relative block w-full overflow-hidden rounded-sm bg-ink-3" style={style}>
                  {tile}
                </button>
              ) : (
                <Link href={`/studio/photos/${p.id}`} className="group relative block overflow-hidden rounded-sm bg-ink-3" style={style}>
                  {tile}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {bulk && selecting && picked.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-sm">
            <span className="mr-2 text-mute">{picked.size} selected</span>
            <button disabled={pending} onClick={() => run(() => bulk.setVisibility(ids, "public"))} className="rounded-full bg-paper px-3 py-1.5 text-ink hover:bg-brass-2">Make public</button>
            <button disabled={pending} onClick={() => run(() => bulk.setVisibility(ids, "unlisted"))} className="rounded-full border border-line px-3 py-1.5 hover:border-brass">Link only</button>
            <button disabled={pending} onClick={() => run(() => bulk.setVisibility(ids, "private"))} className="rounded-full border border-line px-3 py-1.5 hover:border-brass">Private</button>
            <select
              disabled={pending}
              value=""
              aria-label="Add to album"
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__new") {
                  const title = window.prompt("Name the new album");
                  if (title?.trim()) {
                    const f = new FormData();
                    f.set("title", title.trim());
                    f.set("stay", "1");
                    ids.forEach((id) => f.append("photoId", id));
                    run(() => bulk.newAlbum(f));
                  }
                } else if (v) run(() => bulk.addToAlbum(v, ids));
              }}
              className="h-8 rounded-full border border-line bg-ink-2 px-3 text-sm"
            >
              <option value="">Add to album…</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              <option value="__new">+ New album</option>
            </select>
          </div>
        </div>
      )}
    </section>
  );
}
