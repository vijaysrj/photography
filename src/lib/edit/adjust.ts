import type { Adjustments } from "./types";

/**
 * The colour and light engine. Pure maths on RGBA pixels, so it runs anywhere
 * (browser, worker, tests) and costs nothing on the server.
 *
 * Light changes (exposure, contrast, highlights, shadows, fade) only depend on a
 * pixel's own value, so they're folded into one 256-entry lookup table. Colour
 * changes and the vignette are done per pixel.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export function toneCurve(a: Adjustments): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const gain = Math.pow(2, (a.exposure / 100) * 2);
  const k = a.contrast / 100;
  const hi = a.highlights / 100;
  const sh = a.shadows / 100;
  const lift = (a.fade / 100) * 0.22;
  for (let i = 0; i < 256; i++) {
    // Work in approximately linear light for exposure, then back to display values.
    let v = Math.pow(i / 255, 2.2) * gain;
    v = Math.pow(clamp01(v), 1 / 2.2);
    // Highlights and shadows: lift or pull the top and bottom of the range.
    v += hi * 0.35 * smooth(0.45, 1, v) * (hi > 0 ? 1 - v : v);
    v += sh * 0.35 * (1 - smooth(0, 0.55, v)) * (sh > 0 ? 1 - v : v);
    // Contrast: an S-curve around the midtones that never clips.
    if (k !== 0) {
      const s = k > 0 ? 1 + k * 2.2 : 1 + k * 0.85;
      const x = v - 0.5;
      v = 0.5 + (k > 0 ? Math.tanh(x * s * 2) / (2 * Math.tanh(s)) : x * s);
    }
    // Fade: raise the blacks, gently lower the whites.
    v = lift + v * (1 - lift - lift * 0.25);
    lut[i] = Math.round(clamp01(v) * 255);
  }
  return lut;
}

export function applyAdjustments(data: Uint8ClampedArray, width: number, height: number, a: Adjustments, mono = false) {
  const lut = toneCurve(a);
  const warm = a.warmth / 100;
  const tint = a.tint / 100;
  const sat = mono ? -1 : a.saturation / 100;
  const vib = a.vibrance / 100;
  const vig = a.vignette / 100;
  const cx = width / 2;
  const cy = height / 2;
  const maxD = Math.hypot(cx, cy);
  const doColour = warm !== 0 || tint !== 0 || sat !== 0 || vib !== 0;

  for (let y = 0, i = 0; y < height; y++) {
    const dy = (y - cy) / maxD;
    for (let x = 0; x < width; x++, i += 4) {
      let r = lut[data[i]];
      let g = lut[data[i + 1]];
      let b = lut[data[i + 2]];

      if (doColour) {
        // Warmth and tint: white-balance style shifts.
        r += warm * 28 + tint * 10;
        g -= tint * 22;
        b -= warm * 32 - tint * 10;
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        let s = 1 + sat;
        if (vib !== 0) {
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const chroma = (max - min) / 255;
          s *= 1 + vib * (1 - chroma) * 1.2;
        }
        r = l + (r - l) * s;
        g = l + (g - l) * s;
        b = l + (b - l) * s;
      }

      if (vig !== 0) {
        const dx = (x - cx) / maxD;
        const d = Math.sqrt(dx * dx + dy * dy) / 0.7071;
        const f = smooth(0.35, 1.05, d) * vig * 0.75;
        if (f > 0) {
          r *= 1 - f;
          g *= 1 - f;
          b *= 1 - f;
        } else {
          r += (255 - r) * -f;
          g += (255 - g) * -f;
          b += (255 - b) * -f;
        }
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
}
