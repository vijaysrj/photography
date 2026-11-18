import type { CropRect } from "./types";

/**
 * Crop maths in fractions of the (rotated) photo, so it works at any preview size.
 * `frameRatio` is the photo's width / height after rotation.
 */

export const ASPECTS = [
  { id: "free", label: "Free" },
  { id: "original", label: "Original" },
  { id: "1:1", label: "Square" },
  { id: "4:5", label: "4:5" },
  { id: "5:7", label: "5:7" },
  { id: "2:3", label: "2:3" },
  { id: "3:4", label: "3:4" },
  { id: "16:9", label: "16:9" },
] as const;

export const MIN_CROP = 0.05;

/** Width / height in pixels for an aspect id, or null for free. Ids like "4:5" may be flipped to "5:4". */
export function aspectRatio(id: string, frameRatio: number): number | null {
  if (id === "free") return null;
  if (id === "original") return frameRatio;
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(id);
  return m ? Number(m[1]) / Number(m[2]) : null;
}

export function flipAspect(id: string): string {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(id);
  return m && m[1] !== m[2] ? `${m[2]}:${m[1]}` : id;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Largest crop of the given pixel ratio, centred on the current crop. */
export function fitAspect(current: CropRect, ratio: number | null, frameRatio: number): CropRect {
  if (ratio === null) return current;
  const r = ratio / frameRatio; // ratio in fraction units
  let w = 1;
  let h = w / r;
  if (h > 1) {
    h = 1;
    w = r;
  }
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
}

export function moveCrop(start: CropRect, dx: number, dy: number): CropRect {
  return { ...start, x: clamp(start.x + dx, 0, 1 - start.w), y: clamp(start.y + dy, 0, 1 - start.h) };
}

export type Corner = "nw" | "ne" | "sw" | "se";

/** Drags one corner to (px, py) while the opposite corner stays put. */
export function dragCorner(start: CropRect, corner: Corner, px: number, py: number, ratio: number | null, frameRatio: number): CropRect {
  const ax = corner.includes("w") ? start.x + start.w : start.x; // anchor
  const ay = corner.includes("n") ? start.y + start.h : start.y;
  const dirX = corner.includes("w") ? -1 : 1;
  const dirY = corner.includes("n") ? -1 : 1;
  const maxW = dirX > 0 ? 1 - ax : ax;
  const maxH = dirY > 0 ? 1 - ay : ay;
  let w = clamp((px - ax) * dirX, MIN_CROP, maxW);
  let h = clamp((py - ay) * dirY, MIN_CROP, maxH);
  if (ratio !== null) {
    const r = ratio / frameRatio;
    // Follow whichever way the pointer moved further, then fit inside the photo.
    if (w / r > h) h = w / r;
    else w = h * r;
    if (h > maxH) { h = maxH; w = h * r; }
    if (w > maxW) { w = maxW; h = w / r; }
  }
  return { x: dirX > 0 ? ax : ax - w, y: dirY > 0 ? ay : ay - h, w, h };
}
