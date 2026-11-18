import type { Metadata } from "next";
import { listReadyPhotos, toCard } from "@/lib/photos";
import { bytes } from "@/lib/format";
import { PhotoGrid } from "@/components/photo-grid";
import { Uploader } from "@/components/uploader";

export const metadata: Metadata = { title: "Library" };

const FREE_BYTES = 10 * 1024 ** 3; // R2 free allowance

export default async function StudioPage() {
  const photos = await listReadyPhotos();
  const cards = await Promise.all(photos.map(toCard));
  const used = photos.reduce(
    (sum, p) => sum + p.sizeBytes + Object.values(p.variants).reduce((s, v) => s + (v?.bytes ?? 0), 0),
    0,
  );
  const pct = Math.min(100, (used / FREE_BYTES) * 100);

  return (
    <main className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-8 sm:pt-12">
      <section className="animate-rise flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="mt-2 font-display text-5xl font-light sm:text-6xl">
            {photos.length === 0 ? "Begin with a photograph" : `${photos.length} photograph${photos.length === 1 ? "" : "s"}`}
          </h1>
        </div>
        <div className="w-full max-w-xs" title="Cloudflare R2 storage used, including web copies">
          <div className="flex justify-between text-xs text-mute">
            <span>{bytes(used)} stored</span>
            <span>{used <= FREE_BYTES ? "within the free 10 GB" : `${bytes(used - FREE_BYTES)} over free tier`}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brass transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      <Uploader className="mt-10" compact={photos.length > 0} />

      <PhotoGrid photos={cards} className="mt-12" />
    </main>
  );
}
