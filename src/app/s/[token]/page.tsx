import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { albumPhotos, resolveShareToken, toGalleryPhoto, toGalleryPhotos } from "@/lib/gallery";
import { AlbumView } from "@/components/album-view";
import { PhotoView } from "@/components/photo-view";
import { shareMetadata } from "@/lib/share-meta";

// Secret links are always checked fresh, so turning sharing off takes effect immediately.
export const dynamic = "force-dynamic";

async function load(token: string) {
  const hit = await resolveShareToken(token);
  if (!hit) return null;
  if (hit.kind === "photo") return { kind: "photo" as const, photo: await toGalleryPhoto(hit.photo) };
  return { kind: "album" as const, album: hit.album, photos: await toGalleryPhotos(await albumPhotos(hit.album.id)) };
}

export async function generateMetadata({ params }: PageProps<"/s/[token]">): Promise<Metadata> {
  const data = await load((await params).token);
  if (!data) return { robots: { index: false } };
  if (data.kind === "photo") return shareMetadata({ title: data.photo.title || "Photograph", description: data.photo.description, image: data.photo, index: false });
  const cover = data.photos.find((p) => p.id === data.album.coverPhotoId) ?? data.photos[0];
  return shareMetadata({ title: data.album.title, description: data.album.description, image: cover, index: false });
}

export default async function SharedLink({ params }: PageProps<"/s/[token]">) {
  const data = await load((await params).token);
  if (!data) notFound();
  return data.kind === "photo" ? <PhotoView photo={data.photo} /> : <AlbumView album={data.album} photos={data.photos} />;
}
