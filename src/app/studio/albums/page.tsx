import type { Metadata } from "next";
import { allAlbums } from "@/lib/gallery";
import { AlbumCards } from "@/components/album-cards";
import { createAlbum } from "../actions";

export const metadata: Metadata = { title: "Albums" };

export default async function AlbumsPage() {
  const albums = await allAlbums();
  return (
    <main className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-8 sm:pt-12">
      <section className="animate-rise flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Albums</p>
          <h1 className="mt-2 font-display text-5xl font-light sm:text-6xl">{albums.length === 0 ? "Gather your work" : "Collections"}</h1>
          <p className="mt-3 max-w-md text-sm text-mute">Group photos into series. Share an album by link, or make it public to show it on your site.</p>
        </div>
        <form action={createAlbum} className="flex w-full gap-2 sm:w-auto">
          <input name="title" required placeholder="New album name" aria-label="New album name" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-ink-2 px-4 text-sm outline-none focus:border-brass sm:w-64" />
          <button className="btn bg-paper text-ink hover:bg-brass-2">Create</button>
        </form>
      </section>
      <div className="mt-12">
        <AlbumCards albums={albums} hrefFor={(a) => `/studio/albums/${a.id}`} showVisibility />
      </div>
    </main>
  );
}
