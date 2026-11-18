/**
 * A photo's edits, stored as a small recipe. The original file is never changed:
 * web copies and downloads are made by applying this recipe to it.
 */

export type Adjustments = {
  exposure: number; // -100..100  (±2 stops)
  contrast: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  warmth: number; // -100..100  (blue ↔ amber)
  tint: number; // -100..100  (green ↔ magenta)
  saturation: number; // -100..100 (-100 = black and white)
  vibrance: number; // -100..100 (boosts muted colours more than strong ones)
  fade: number; // 0..100 (lifts the blacks for a matte look)
  vignette: number; // -100..100 (darken or lighten the edges)
};

/** Crop rectangle as fractions (0..1) of the rotated, flipped image. */
export type CropRect = { x: number; y: number; w: number; h: number };

export type Geometry = {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  straighten: number; // -45..45 degrees
  crop: CropRect;
  aspect: string; // "free" | "original" | "1:1" | "4:5" … remembered for the crop tool
};

export type Edits = {
  version: 1;
  preset: string | null;
  mono: boolean;
  adjust: Adjustments;
  geometry: Geometry;
};

export const ZERO: Adjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  warmth: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  fade: 0,
  vignette: 0,
};

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export function emptyEdits(): Edits {
  return {
    version: 1,
    preset: null,
    mono: false,
    adjust: { ...ZERO },
    geometry: { rotate: 0, flipH: false, straighten: 0, crop: { ...FULL_CROP }, aspect: "free" },
  };
}

export function isIdentity(e: Edits | null | undefined): boolean {
  if (!e) return true;
  const g = e.geometry;
  const c = g.crop;
  return (
    !e.mono &&
    Object.values(e.adjust).every((v) => v === 0) &&
    g.rotate === 0 &&
    !g.flipH &&
    g.straighten === 0 &&
    c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1
  );
}
