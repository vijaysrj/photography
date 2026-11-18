import type { Album } from "@/lib/db/schema";
import type { GalleryPhoto } from "@/lib/gallery";
import { Gallery } from "./gallery";

/** The visitor's view of an album, used by public album pages and secret album links. */
export function AlbumView({ album, photos }: { album: Album; photos: GalleryPhoto[] }) {
  return (
    <main className="mx-auto max-w-7xl px-5 pt-32 pb-24 sm:px-10 sm:pt-40">
      <header className="animate-rise mb-14 max-w-3xl">
        <p className="eyebrow">Album · {photos.length} {photos.length === 1 ? "photograph" : "photographs"}</p>
        <h1 className="mt-3 font-display text-5xl leading-none font-light sm:text-7xl">{album.title}</h1>
        {album.description && <p className="mt-6 text-lg leading-relaxed whitespace-pre-line text-paper/75">{album.description}</p>}
      </header>
      {photos.length ? <Gallery photos={photos} /> : <p className="text-mute">Nothing here yet.</p>}
    </main>
  );
}
