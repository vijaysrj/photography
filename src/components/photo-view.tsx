"use client";

import { useState } from "react";
import type { GalleryPhoto } from "@/lib/gallery";
import { Lightbox } from "./lightbox";

/** One photograph, shown large, with details. Tap to open full screen. */
export function PhotoView({ photo }: { photo: GalleryPhoto }) {
  const [open, setOpen] = useState(false);
  const date = photo.takenAt ? new Date(photo.takenAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" }) : null;
  return (
    <main className="mx-auto max-w-7xl px-5 pt-28 pb-24 sm:px-10 sm:pt-32">
      <button type="button" onClick={() => setOpen(true)} className="animate-rise mx-auto block cursor-zoom-in" aria-label="View full screen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.large}
          alt={photo.title}
          width={photo.width}
          height={photo.height}
          className="mx-auto max-h-[78svh] w-auto shadow-[0_40px_100px_-40px_rgba(0,0,0,.95)]"
          style={{ backgroundColor: photo.color ?? undefined }}
        />
      </button>
      <div className="animate-rise mx-auto mt-10 max-w-2xl text-center [animation-delay:150ms]">
        {photo.title && <h1 className="font-display text-4xl font-light sm:text-5xl">{photo.title}</h1>}
        {photo.description && <p className="mt-4 leading-relaxed whitespace-pre-line text-paper/75">{photo.description}</p>}
        {(photo.camera || date) && <p className="eyebrow mt-6">{[date, photo.camera].filter(Boolean).join(" · ")}</p>}
      </div>
      {open && <Lightbox photos={[photo]} index={0} onIndex={() => {}} onClose={() => setOpen(false)} />}
    </main>
  );
}
