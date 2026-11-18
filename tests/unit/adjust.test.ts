import { describe, expect, it } from "vitest";
import { applyAdjustments, toneCurve } from "@/lib/edit/adjust";
import { ZERO, emptyEdits, isIdentity } from "@/lib/edit/types";
import { PRESETS, presetAdjustments } from "@/lib/edit/presets";

const pixel = (r: number, g: number, b: number) => new Uint8ClampedArray([r, g, b, 255]);
const run = (px: Uint8ClampedArray, a = {}, mono = false) => {
  applyAdjustments(px, 1, 1, { ...ZERO, ...a }, mono);
  return [...px.slice(0, 3)];
};

describe("light and colour engine", () => {
  it("leaves pixels alone when nothing is changed", () => {
    const lut = toneCurve(ZERO);
    for (let i = 0; i < 256; i++) expect(Math.abs(lut[i] - i)).toBeLessThanOrEqual(1);
    expect(run(pixel(12, 130, 250))).toEqual([12, 130, 250]);
  });

  it("brightens with exposure and darkens with negative exposure", () => {
    const [up] = run(pixel(100, 100, 100), { exposure: 50 });
    const [down] = run(pixel(100, 100, 100), { exposure: -50 });
    expect(up).toBeGreaterThan(120);
    expect(down).toBeLessThan(80);
  });

  it("keeps the tone curve smooth and in order (no banding or flips)", () => {
    for (const p of PRESETS) {
      const lut = toneCurve(presetAdjustments(p));
      for (let i = 1; i < 256; i++) expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1]);
    }
  });

  it("adds contrast without clipping midtones", () => {
    const [darker] = run(pixel(80, 80, 80), { contrast: 60 });
    const [lighter] = run(pixel(180, 180, 180), { contrast: 60 });
    expect(darker).toBeLessThan(80);
    expect(lighter).toBeGreaterThan(180);
    expect(darker).toBeGreaterThan(0);
    expect(lighter).toBeLessThan(255);
  });

  it("makes true black and white when mono", () => {
    const [r, g, b] = run(pixel(200, 60, 30), {}, true);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("warms and cools", () => {
    const [wr, , wb] = run(pixel(128, 128, 128), { warmth: 60 });
    expect(wr).toBeGreaterThan(wb);
    const [cr, , cb] = run(pixel(128, 128, 128), { warmth: -60 });
    expect(cb).toBeGreaterThan(cr);
  });

  it("lifts blacks with fade", () => {
    expect(run(pixel(0, 0, 0), { fade: 100 })[0]).toBeGreaterThan(40);
  });

  it("darkens corners, not the centre, with vignette", () => {
    const w = 21, h = 21;
    const data = new Uint8ClampedArray(w * h * 4).fill(200);
    applyAdjustments(data, w, h, { ...ZERO, vignette: 80 });
    const at = (x: number, y: number) => data[(y * w + x) * 4];
    expect(at(10, 10)).toBe(200);
    expect(at(0, 0)).toBeLessThan(120);
  });

  it("knows when a recipe changes nothing", () => {
    expect(isIdentity(null)).toBe(true);
    expect(isIdentity(emptyEdits())).toBe(true);
    const e = emptyEdits();
    e.geometry.rotate = 90;
    expect(isIdentity(e)).toBe(false);
  });
});
