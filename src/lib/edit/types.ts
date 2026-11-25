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

const num = (v: unknown, lo: number, hi: number, fallback = 0) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
};
/** Crop fractions are kept to 6 decimals: far finer than a pixel, and free of float drift. */
const frac = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * Pulls every value back into its allowed range. Dragging the crop box or
 * stacking rotations can leave tiny rounding errors (say x = -0.00000001) or a
 * stray NaN, which the server would otherwise reject as an invalid request.
 */
export function sanitizeEdits(input: Edits): Edits {
  const e = emptyEdits();
  const a = (input?.adjust ?? {}) as Partial<Adjustments>;
  const g = (input?.geometry ?? {}) as Partial<Geometry>;
  const c = (g.crop ?? {}) as Partial<CropRect>;
  const adjust = { ...ZERO };
  for (const k of Object.keys(ZERO) as (keyof Adjustments)[]) adjust[k] = num(a[k], k === "fade" ? 0 : -100, 100);
  const w = frac(num(c.w, 0.01, 1, 1));
  const h = frac(num(c.h, 0.01, 1, 1));
  const rotation = ((Math.round(num(g.rotate, -3600, 3600) / 90) * 90) % 360 + 360) % 360;
  return {
    version: 1,
    preset: typeof input?.preset === "string" ? input.preset.slice(0, 40) : null,
    mono: !!input?.mono,
    adjust,
    geometry: {
      rotate: rotation as Geometry["rotate"],
      flipH: !!g.flipH,
      straighten: num(g.straighten, -45, 45),
      crop: { x: frac(num(c.x, 0, 1 - w)), y: frac(num(c.y, 0, 1 - h)), w, h },
      aspect: typeof g.aspect === "string" ? g.aspect.slice(0, 20) : e.geometry.aspect,
    },
  };
}
