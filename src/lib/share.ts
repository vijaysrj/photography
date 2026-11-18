import type { Visibility } from "@/lib/db/schema";

export function slugify(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "album"
  );
}

/** Public address for a photo or album, or the secret link when it's unlisted. */
export function sharePath(item: { kind: "photo"; id: string; visibility: Visibility; shareToken: string | null } | { kind: "album"; slug: string; visibility: Visibility; shareToken: string | null }): string | null {
  if (item.visibility === "private") return null;
  if (item.visibility === "unlisted") return item.shareToken ? `/s/${item.shareToken}` : null;
  return item.kind === "photo" ? `/photos/${item.id}` : `/albums/${item.slug}`;
}
