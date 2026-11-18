import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { albumById, albumPhotos, sharePath } from "@/lib/gallery";
import { listReadyPhotos, toCard } from "@/lib/photos";
import { ShareControls } from "@/components/share-controls";
import { DeleteButton } from "@/components/delete-button";
import { AlbumEditor } from "@/components/album-editor";
import {
  addPhotosToAlbum,
  deleteAlbum,
  movePhotoInAlbum,
  removePhotoFromAlbum,
  resetAlbumLink,
  setAlbumCover,
  setAlbumVisibility,
  updateAlbumText,
} from "../../actions";

export async function generateMetadata({ params }: PageProps<"/studio/albums/[id]">): Promise<Metadata> {
  return { title: (await albumById((await params).id))?.title ?? "Album" };
}

export default async function AlbumPage({ params }: PageProps<"/studio/albums/[id]">) {
  const { id } = await params;
  const album = await albumById(id);
  if (!album) notFound();
  const [inAlbum, library] = await Promise.all([albumPhotos(id), listReadyPhotos()]);
  const inIds = new Set(inAlbum.map((p) => p.id));
  const [cards, others] = await Promise.all([
    Promise.all(inAlbum.map(toCard)),
    Promise.all(library.filter((p) => !inIds.has(p.id)).map(toCard)),
  ]);
  const path = sharePath({ kind: "album", slug: album.slug, visibility: album.visibility, shareToken: album.shareToken });

  async function changeVisibility(v: string) {
    "use server";
    await setAlbumVisibility(id, v);
  }
  async function resetLink() {
    "use server";
    await resetAlbumLink(id);
  }
  async function add(ids: string[]) {
    "use server";
    await addPhotosToAlbum(id, ids);
  }
  async function remove(photoId: string) {
    "use server";
    await removePhotoFromAlbum(id, photoId);
  }
  async function cover(photoId: string) {
    "use server";
    await setAlbumCover(id, photoId);
  }
  async function move(photoId: string, dir: -1 | 1) {
    "use server";
    await movePhotoInAlbum(id, photoId, dir);
  }
  async function destroy() {
    "use server";
    await deleteAlbum(id);
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-10 px-4 pt-6 pb-24 sm:px-8 lg:grid-cols-[1fr_320px] lg:pt-10">
      <div className="min-w-0">
        <Link href="/studio/albums" className="eyebrow hover:text-brass">← Albums</Link>
        <AlbumEditor
          photos={cards}
          library={others}
          coverId={album.coverPhotoId}
          onAdd={add}
          onRemove={remove}
          onCover={cover}
          onMove={move}
        />
      </div>

      <aside className="flex flex-col gap-8 lg:pt-10">
        <form action={updateAlbumText.bind(null, id)} className="group">
          <label htmlFor="title" className="eyebrow">Album</label>
          <input id="title" name="title" required defaultValue={album.title} className="mt-2 w-full border-b border-transparent bg-transparent pb-1 font-display text-4xl font-light outline-none hover:border-line focus:border-brass" />
          <textarea name="description" aria-label="Description" defaultValue={album.description} rows={3} placeholder="A few words about this series" className="mt-3 w-full resize-none rounded-lg border border-transparent bg-transparent text-sm leading-relaxed text-paper/80 outline-none placeholder:text-faint hover:border-line focus:border-brass focus:p-2" />
          <button className="mt-1 text-xs text-brass opacity-0 transition-opacity group-focus-within:opacity-100">Save</button>
        </form>
        <ShareControls noun="album" visibility={album.visibility} path={path} onChange={changeVisibility} onResetLink={resetLink} />
        <p className="text-xs leading-relaxed text-faint">Anyone who can open this album can see every photo in it, even photos that are private on their own.</p>
        <div>
          <DeleteButton action={destroy} />
          <p className="mt-2 text-xs text-faint">Deleting an album keeps its photos in your library.</p>
        </div>
      </aside>
    </main>
  );
}
