import Link from "next/link";
import { site } from "@/lib/site";
import { publicAlbums, publicPhotos, toGalleryPhotos } from "@/lib/gallery";
import { Gallery } from "@/components/gallery";
import { AlbumCards } from "@/components/album-cards";

// Built when someone visits, then reused for a minute; studio edits refresh it at once.
export const revalidate = 60;

export default async function Home() {
  const [photos, albums] = await Promise.all([publicPhotos().then(toGalleryPhotos), publicAlbums()]);
  const hero = photos.find((p) => p.width >= p.height) ?? photos[0];

  if (!hero) {
    return (
      <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_40%,#2a241c_0%,transparent_70%)]" />
        <div className="relative flex flex-col items-center text-center">
          <div className="animate-rise relative mb-12 aspect-[4/5] w-48 border border-brass/60 p-3 shadow-[0_40px_80px_-30px_rgba(0,0,0,.9)] sm:w-56">
            <div className="h-full w-full bg-[linear-gradient(160deg,#3a3127_0%,#1b1814_55%,#0f0e0c_100%)] p-5">
              <div className="h-full w-full border border-paper/10" />
            </div>
          </div>
          <p className="eyebrow animate-rise [animation-delay:120ms]">{site.tagline}</p>
          <h1 className="animate-rise mt-4 font-display text-5xl font-light tracking-tight [animation-delay:200ms] sm:text-7xl">{site.name}</h1>
          <p className="animate-rise mt-5 max-w-sm text-mute [animation-delay:280ms]">{site.description} The gallery is being hung. Please come back soon.</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <section className="relative h-[92svh] min-h-[520px] overflow-hidden" style={{ backgroundColor: hero.color ?? undefined }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero.large} alt={hero.title} className="animate-[rise_1600ms_var(--ease-gallery)_both] absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-5 pb-14 sm:px-10 sm:pb-20">
          <p className="eyebrow animate-rise text-paper/70 [animation-delay:300ms]">{site.tagline}</p>
          <h1 className="animate-rise mt-3 max-w-3xl font-display text-5xl leading-[0.95] font-light [animation-delay:400ms] sm:text-8xl">{site.description}</h1>
          <Link href="#work" className="animate-rise mt-8 inline-flex items-center gap-3 text-sm text-paper/80 [animation-delay:550ms] hover:text-brass">
            <span className="h-px w-10 bg-current" /> View the work
          </Link>
        </div>
      </section>

      {albums.length > 0 && (
        <section id="albums" className="mx-auto max-w-7xl scroll-mt-20 px-5 pt-24 sm:px-10">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="eyebrow">Series</p>
              <h2 className="mt-2 font-display text-4xl font-light sm:text-5xl">Albums</h2>
            </div>
          </div>
          <AlbumCards albums={albums} hrefFor={(a) => `/albums/${a.slug}`} />
        </section>
      )}

      <section id="work" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-10">
        <div className="mb-10">
          <p className="eyebrow">Selected</p>
          <h2 className="mt-2 font-display text-4xl font-light sm:text-5xl">Work</h2>
        </div>
        <Gallery photos={photos} />
      </section>
    </main>
  );
}
