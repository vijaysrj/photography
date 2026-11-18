import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Lets you "Add to Home Screen" on your phone and open the studio like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    background_color: "#0f0e0c",
    theme_color: "#0f0e0c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
