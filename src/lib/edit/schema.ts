import { z } from "zod";

const n = (min: number, max: number) => z.number().min(min).max(max);

export const EditsSchema = z.object({
  version: z.literal(1),
  preset: z.string().max(40).nullable(),
  mono: z.boolean(),
  adjust: z.object({
    exposure: n(-100, 100),
    contrast: n(-100, 100),
    highlights: n(-100, 100),
    shadows: n(-100, 100),
    warmth: n(-100, 100),
    tint: n(-100, 100),
    saturation: n(-100, 100),
    vibrance: n(-100, 100),
    fade: n(0, 100),
    vignette: n(-100, 100),
  }),
  geometry: z.object({
    rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    flipH: z.boolean(),
    straighten: n(-45, 45),
    crop: z
      .object({ x: n(0, 1), y: n(0, 1), w: n(0.01, 1), h: n(0.01, 1) })
      .refine((c) => c.x + c.w <= 1.0001 && c.y + c.h <= 1.0001, "Crop must stay inside the photo"),
    aspect: z.string().max(20),
  }),
});
