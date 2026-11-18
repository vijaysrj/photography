import { ZERO, type Adjustments } from "./types";

export type Preset = { id: string; name: string; mono?: boolean; adjust: Partial<Adjustments> };

/** Looks tuned for landscapes, travel and portraits. Each is a starting point you can adjust. */
export const PRESETS: Preset[] = [
  { id: "vivid", name: "Vivid", adjust: { contrast: 18, vibrance: 35, saturation: 8, shadows: 10 } },
  { id: "golden", name: "Golden", adjust: { warmth: 32, exposure: 6, highlights: -15, vibrance: 15, contrast: 8 } },
  { id: "matte", name: "Matte", adjust: { fade: 28, contrast: -18, saturation: -12, shadows: 12 } },
  { id: "film", name: "Film", adjust: { fade: 14, warmth: 12, tint: 6, contrast: 10, saturation: -8, vignette: 18 } },
  { id: "cool", name: "Cool", adjust: { warmth: -28, tint: -4, contrast: 10, highlights: -10 } },
  { id: "drama", name: "Drama", adjust: { contrast: 38, highlights: -35, shadows: -10, vignette: 32, vibrance: 10 } },
  { id: "soft", name: "Soft", adjust: { contrast: -22, highlights: -20, shadows: 25, exposure: 5 } },
  { id: "mono", name: "Mono", mono: true, adjust: { contrast: 15 } },
  { id: "noir", name: "Noir", mono: true, adjust: { contrast: 45, shadows: -20, vignette: 35, highlights: 10 } },
  { id: "silver", name: "Silver", mono: true, adjust: { contrast: -10, fade: 22, warmth: 0 } },
];

export function presetAdjustments(p: Preset): Adjustments {
  return { ...ZERO, ...p.adjust };
}
