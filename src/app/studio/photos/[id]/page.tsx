import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPhoto } from "@/lib/photos";
import { signView } from "@/lib/storage";
import { bytes, megapixels, shutter } from "@/lib/format";
import { DeleteButton } from "@/components/delete-button";
import { ShareControls } from "@/components/share-controls";
import { AlbumPicker } from "@/components/album-picker";
import { albumIdsForPhoto, allAlbums, sharePath } from "@/lib/gallery";
import { createAlbum, deletePhoto, resetPhotoLink, setPhotoInAlbum, setPhotosVisibility, updatePhotoText } from "../../actions";

export async function generateMetadata({ params }: PageProps<"/studio/photos/[id]">): Promise<Metadata> {
  const photo = await getPhoto((await params).id);
  return { title: photo?.title || "Photo" };
}

export default async function PhotoPage({ params }: PageProps<"/studio/photos/[id]">) {
  const { id } = await params;
  const photo = await getPhoto(id);
  if (!photo || photo.status !== "ready") notFound();

  const view = photo.variants.large ?? photo.variants.medium ?? photo.variants.thumb;
  const [src, placeholder, download, albums, inAlbums] = await Promise.all([
    view ? signView(view.key) : null,
    photo.variants.thumb ? signView(photo.variants.thumb.key) : null,
    signView(photo.originalKey, { downloadName: photo.originalName }),
    allAlbums(),
    albumIdsForPhoto(photo.id),
  ]);
  const path = sharePath({ kind: "photo", id: photo.id, visibility: photo.visibility, shareToken: photo.shareToken });

  async function changeVisibility(v: string) {
    "use server";
    await setPhotosVisibility([id], v);
  }
  async function resetLink() {
    "use server";
    await resetPhotoLink(id);
  }
  async function toggleAlbum(albumId: string, on: boolean) {
    "use server";
    await setPhotoInAlbum(id, albumId, on);
  }
  async function newAlbum(form: FormData) {
    "use server";
    form.append("photoId", id);
    await createAlbum(form);
  }
  const e = photo.exif;
  const camera = [e.make && e.model && !e.model.startsWith(e.make) ? `${e.make} ${e.model}` : e.model ?? e.make, e.lens]
    .filter(Boolean)
    .join(" · ");
  const settings = [e.focalLength && `${Math.round(e.focalLength)}mm`, e.aperture && `ƒ/${e.aperture}`, shutter(e.exposureTime), e.iso && `ISO ${e.iso}`]
    .filter(Boolean)
    .join("  ");

  const details: [string, string | undefined][] = [
    ["Taken", photo.takenAt?.toLocaleDateString("en-IN", { dateStyle: "long" })],
    ["Camera", camera || undefined],
    ["Settings", settings || undefined],
    ["Original", [photo.width && photo.height ? `${photo.width} × ${photo.height}` : undefined, megapixels(photo.width, photo.height), bytes(photo.sizeBytes)].filter(Boolean).join(" · ")],
    ["File", photo.originalName],
  ];

  return (
    <main className="mx-auto grid max-w-7xl gap-8 px-4 pt-6 pb-24 sm:px-8 lg:grid-cols-[1fr_320px] lg:gap-12 lg:pt-10">
      <div className="animate-rise">
        <Link href="/studio" className="eyebrow inline-flex items-center gap-2 hover:text-brass">← Library</Link>
        <div
          className="mt-4 flex items-center justify-center rounded-sm bg-ink-2 lg:min-h-[70vh]"
          style={{ backgroundColor: photo.dominantColor ? `${photo.dominantColor}22` : undefined }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={photo.title}
              width={view?.width}
              height={view?.height}
              className="max-h-[80vh] w-auto object-contain shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)]"
              style={{ backgroundImage: placeholder ? `url(${placeholder})` : undefined, backgroundSize: "cover" }}
            />
          ) : (
            <p className="p-16 text-center text-sm text-mute">This browser couldn&apos;t make a preview for this format. The original is safely stored.</p>
          )}
        </div>
      </div>

      <aside className="animate-rise flex flex-col gap-8 [animation-delay:120ms] lg:pt-10">
        <form action={updatePhotoText.bind(null, photo.id)} className="group">
          <label htmlFor="title" className="eyebrow">Title</label>
          <input
            id="title"
            name="title"
            defaultValue={photo.title}
            placeholder="Untitled"
            className="mt-2 w-full border-b border-transparent bg-transparent pb-1 font-display text-4xl font-light outline-none transition-colors hover:border-line focus:border-brass"
          />
          <label htmlFor="description" className="sr-only">Caption</label>
          <textarea
            id="description"
            name="description"
            defaultValue={photo.description}
            placeholder="Add a caption or the story behind it"
            rows={2}
            className="mt-3 w-full resize-none rounded-lg border border-transparent bg-transparent text-sm leading-relaxed text-paper/80 outline-none transition-colors placeholder:text-faint hover:border-line focus:border-brass focus:p-2"
          />
          <button className="mt-1 text-xs text-brass opacity-0 transition-opacity group-focus-within:opacity-100">Save</button>
        </form>

        <ShareControls visibility={photo.visibility} path={path} onChange={changeVisibility} onResetLink={resetLink} />

        <AlbumPicker albums={albums.map((a) => ({ id: a.id, title: a.title }))} selected={inAlbums} onToggle={toggleAlbum} onCreate={newAlbum} />

        <dl className="grid gap-4 text-sm">
          {details.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[88px_1fr] gap-3">
              <dt className="text-faint">{k}</dt>
              <dd className="break-words text-paper/90">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-3">
          <a href={download} className="btn bg-paper text-ink hover:bg-brass-2">Download original</a>
          <DeleteButton action={deletePhoto.bind(null, photo.id)} />
        </div>
      </aside>
    </main>
  );
}
