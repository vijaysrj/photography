import type { Metadata } from "next";
import { site } from "@/lib/site";
import type { GalleryPhoto } from "@/lib/gallery";

/** Title, description and preview image for link previews (WhatsApp, Instagram, iMessage…). */
export function shareMetadata(opts: { title: string; description?: string; image?: GalleryPhoto; index?: boolean }): Metadata {
  const description = opts.description || site.description;
  const images = opts.image ? [{ url: opts.image.medium, width: 1280, height: Math.round((1280 * opts.image.height) / opts.image.width) }] : undefined;
  return {
    title: opts.title,
    description,
    robots: opts.index === false ? { index: false, follow: false } : undefined,
    openGraph: { title: opts.title, description, siteName: site.name, type: "website", images },
    twitter: { card: "summary_large_image", title: opts.title, description, images: images?.map((i) => i.url) },
  };
}
