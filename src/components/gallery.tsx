"use client";

import { useCallback, useEffect, useState } from "react";
import type { GalleryPhoto } from "@/lib/gallery";
import { Lightbox } from "./lightbox";

/**
 * Public masonry gallery that opens the full-screen viewer. The open photo is kept
 * in the address (?photo=…), so a link can point straight at it.
 */
export function Gallery({ photos, className = "" }: { photos: GalleryPhoto[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("photo");
    const i = id ? photos.findIndex((p) => p.id === id) : -1;
    // Reading the address happens after hydration so the server and browser render the same grid.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (i >= 0) setOpen(i);
  }, [photos]);

  const show = useCallback(
    (i: number | null) => {
      setOpen(i);
      const url = new URL(window.location.href);
      if (i === null) url.searchParams.delete("photo");
      else url.searchParams.set("photo", photos[i].id);
      window.history.replaceState(null, "", url);
    },
    [photos],
  );

  if (photos.length === 0) return null;

  return (
    <>
      <ul className={`columns-1 gap-4 min-[480px]:columns-2 lg:columns-3 lg:gap-6 ${className}`}>
        {photos.map((p, i) => (
          <li key={p.id} className="animate-rise mb-4 break-inside-avoid lg:mb-6" style={{ animationDelay: `${Math.min(i, 9) * 50}ms` }}>
            <button
              type="button"
              onClick={() => show(i)}
              className="group relative block w-full cursor-zoom-in overflow-hidden text-left"
              style={{ aspectRatio: `${p.width} / ${p.height}`, backgroundColor: p.color ?? undefined }}
              aria-label={`Open ${p.title || "photo"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.medium}
                srcSet={`${p.thumb} 480w, ${p.medium} 1280w`}
                sizes="(min-width: 1024px) 33vw, (min-width: 480px) 50vw, 100vw"
                alt={p.title}
                loading={i < 6 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-gallery)] group-hover:scale-[1.025]"
              />
              {p.title && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 font-display text-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  {p.title}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox photos={photos} index={open} onIndex={show} onClose={() => show(null)} />}
    </>
  );
}
