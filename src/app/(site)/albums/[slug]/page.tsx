import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { albumPhotos, publicAlbumBySlug, toGalleryPhotos } from "@/lib/gallery";
import { AlbumView } from "@/components/album-view";
import { shareMetadata } from "@/lib/share-meta";

export const revalidate = 60;

async function load(slug: string) {
  const album = await publicAlbumBySlug(slug);
  if (!album) return null;
  return { album, photos: await toGalleryPhotos(await albumPhotos(album.id)) };
}

export async function generateMetadata({ params }: PageProps<"/albums/[slug]">): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return {};
  const cover = data.photos.find((p) => p.id === data.album.coverPhotoId) ?? data.photos[0];
  return shareMetadata({ title: data.album.title, description: data.album.description, image: cover });
}

export default async function PublicAlbum({ params }: PageProps<"/albums/[slug]">) {
  const data = await load((await params).slug);
  if (!data) notFound();
  return <AlbumView album={data.album} photos={data.photos} />;
}
