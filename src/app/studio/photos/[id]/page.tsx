import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPhoto } from "@/lib/photos";
import { signView } from "@/lib/storage";
import { bytes, megapixels, shutter } from "@/lib/format";
import { DeleteButton } from "@/components/delete-button";
import { deletePhoto, renamePhoto } from "../../actions";

export async function generateMetadata({ params }: PageProps<"/studio/photos/[id]">): Promise<Metadata> {
  const photo = await getPhoto((await params).id);
  return { title: photo?.title || "Photo" };
}

export default async function PhotoPage({ params }: PageProps<"/studio/photos/[id]">) {
  const { id } = await params;
  const photo = await getPhoto(id);
  if (!photo || photo.status !== "ready") notFound();

  const view = photo.variants.large ?? photo.variants.medium ?? photo.variants.thumb;
  const [src, placeholder, download] = await Promise.all([
    view ? signView(view.key) : null,
    photo.variants.thumb ? signView(photo.variants.thumb.key) : null,
    signView(photo.originalKey, { downloadName: photo.originalName }),
  ]);
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
    ["Visibility", photo.visibility === "private" ? "Private (only you)" : photo.visibility],
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
        <form action={renamePhoto.bind(null, photo.id)} className="group">
          <label htmlFor="title" className="eyebrow">Title</label>
          <input
            id="title"
            name="title"
            defaultValue={photo.title}
            placeholder="Untitled"
            className="mt-2 w-full border-b border-transparent bg-transparent pb-1 font-display text-4xl font-light outline-none transition-colors hover:border-line focus:border-brass"
          />
          <button className="mt-2 text-xs text-brass opacity-0 transition-opacity group-focus-within:opacity-100">Save title</button>
        </form>

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
        <p className="text-xs leading-relaxed text-faint">
          Sharing, framing previews and editing arrive in the next steps of the plan.
        </p>
      </aside>
    </main>
  );
}
