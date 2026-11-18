import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicPhoto, toGalleryPhoto } from "@/lib/gallery";
import { PhotoView } from "@/components/photo-view";
import { shareMetadata } from "@/lib/share-meta";

export const revalidate = 60;

async function load(id: string) {
  const p = await publicPhoto(id);
  return p ? toGalleryPhoto(p) : null;
}

export async function generateMetadata({ params }: PageProps<"/photos/[id]">): Promise<Metadata> {
  const photo = await load((await params).id);
  return photo ? shareMetadata({ title: photo.title || "Photograph", description: photo.description, image: photo }) : {};
}

export default async function PublicPhoto({ params }: PageProps<"/photos/[id]">) {
  const photo = await load((await params).id);
  if (!photo || !photo.large) notFound();
  return <PhotoView photo={photo} />;
}
