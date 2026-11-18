import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPhoto } from "@/lib/photos";
import { signView } from "@/lib/storage";
import { Editor } from "@/components/editor/editor";

export const metadata: Metadata = { title: "Edit" };

export default async function EditPage({ params }: PageProps<"/studio/photos/[id]/edit">) {
  const { id } = await params;
  const photo = await getPhoto(id);
  if (!photo || photo.status !== "ready") notFound();
  const base = photo.variants.base ?? (photo.editVersion === 0 ? photo.variants.large : undefined);
  if (!base) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-6 text-center text-sm text-mute">
        This photo has no preview this browser can open, so it can&apos;t be edited here. Try uploading it from Safari, or as a JPEG.
      </main>
    );
  }
  const [previewUrl, originalUrl] = await Promise.all([signView(base.key), signView(photo.originalKey)]);
  return <Editor photoId={photo.id} title={photo.title} initial={photo.edits} previewUrl={previewUrl} originalUrl={originalUrl} />;
}
