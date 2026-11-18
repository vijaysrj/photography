import Link from "next/link";
import type { AlbumCard } from "@/lib/gallery";

const BADGE = { private: "Private", unlisted: "Link only", public: "Public" } as const;

/** Albums shown as framed covers with a soft stack behind them. */
export function AlbumCards({ albums, hrefFor, showVisibility = false }: { albums: AlbumCard[]; hrefFor: (a: AlbumCard) => string; showVisibility?: boolean }) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-10 min-[480px]:grid-cols-2 lg:grid-cols-3">
      {albums.map((a, i) => (
        <li key={a.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 9) * 60}ms` }}>
          <Link href={hrefFor(a)} className="group block">
            <div className="relative aspect-[4/3]">
              <div aria-hidden className="absolute inset-0 translate-x-2 -translate-y-2 rounded-sm bg-ink-3 transition-transform duration-500 group-hover:translate-x-3 group-hover:-translate-y-3" />
              <div aria-hidden className="absolute inset-0 translate-x-1 -translate-y-1 rounded-sm bg-line transition-transform duration-500 group-hover:translate-x-1.5 group-hover:-translate-y-1.5" />
              <div className="absolute inset-0 overflow-hidden rounded-sm bg-ink-2" style={{ backgroundColor: a.cover?.color ?? undefined }}>
                {a.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-gallery)] group-hover:scale-[1.04]" />
                ) : (
                  <span className="grid h-full place-items-center text-sm text-faint">Empty album</span>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between gap-3">
              <h3 className="truncate font-display text-2xl">{a.title}</h3>
              <span className="eyebrow shrink-0">{a.count} {a.count === 1 ? "photo" : "photos"}</span>
            </div>
            {showVisibility && <p className="mt-1 text-xs text-faint">{BADGE[a.visibility]}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
