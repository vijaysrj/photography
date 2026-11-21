import type { Photo, Variant } from "@/lib/db/schema";

/**
 * Public pages are cached and can be served hours or days after they were
 * built, so they must never contain storage links that expire. They point at
 * /img/<photo>/<size> instead, and that route hands out a fresh signed link to
 * storage each time (see src/app/img/[id]/[name]/route.ts).
 */

export const VIEW_SIZES = ["thumb", "medium", "large"] as const;
export type ViewSize = (typeof VIEW_SIZES)[number];

const FALLBACK: Record<ViewSize, ViewSize[]> = {
  thumb: ["thumb", "medium", "large"],
  medium: ["medium", "large", "thumb"],
  large: ["large", "medium", "thumb"],
};

/** The web copy shown for a size, falling back to the nearest one that exists. */
export function pickVariant(p: Pick<Photo, "variants">, size: ViewSize): Variant | undefined {
  for (const name of FALLBACK[size]) {
    const v = p.variants[name];
    if (v) return v;
  }
  return undefined;
}

/** A stable address for a photo's web copy. `v` changes after each edit, so browsers fetch the new copy. */
export function viewPath(p: Pick<Photo, "id" | "editVersion">, size: ViewSize): string {
  return `/img/${p.id}/${size}?v=${p.editVersion}`;
}

export const isViewSize = (s: string): s is ViewSize => (VIEW_SIZES as readonly string[]).includes(s);
