import Link from "next/link";
import type { PhotoCard } from "@/lib/photos";

/** Masonry-style grid that keeps each photo's real shape. */
export function PhotoGrid({ photos, className = "" }: { photos: PhotoCard[]; className?: string }) {
  if (photos.length === 0) return null;
  return (
    <ul className={`columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 ${className}`}>
      {photos.map((p, i) => (
        <li key={p.id} className="animate-rise mb-3 break-inside-avoid sm:mb-4" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
          <Link
            href={`/studio/photos/${p.id}`}
            className="group relative block overflow-hidden rounded-sm bg-ink-3"
            style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : "4 / 5", backgroundColor: p.color ?? undefined }}
          >
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
                className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-gallery)] group-hover:scale-[1.03]"
              />
            ) : (
              <span className="grid h-full w-full place-items-center p-4 text-center text-xs text-mute">No preview yet</span>
            )}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span className="truncate text-sm">{p.title || "Untitled"}</span>
              <span className="eyebrow shrink-0 text-[0.6rem]">{p.visibility}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
