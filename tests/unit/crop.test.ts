import { describe, expect, it } from "vitest";
import { aspectRatio, dragCorner, fitAspect, flipAspect, moveCrop } from "@/lib/edit/crop";
import { editedSize, fitSize, straightenScale } from "@/lib/edit/render";

const FULL = { x: 0, y: 0, w: 1, h: 1 };
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe("crop tool", () => {
  it("fits a square into a 3:2 landscape photo", () => {
    const c = fitAspect(FULL, 1, 1.5);
    close(c.h, 1);
    close(c.w * 1.5, c.h); // square in pixels
    close(c.x, (1 - c.w) / 2);
  });

  it("fits a 4:5 portrait crop, and flips to 5:4", () => {
    expect(aspectRatio("4:5", 1.5)).toBeCloseTo(0.8);
    expect(flipAspect("4:5")).toBe("5:4");
    expect(flipAspect("1:1")).toBe("1:1");
    expect(aspectRatio("free", 1.5)).toBeNull();
    expect(aspectRatio("original", 1.5)).toBe(1.5);
  });

  it("keeps a moved crop inside the photo", () => {
    const c = moveCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 0.9, -0.9);
    expect(c).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });

  it("drags a corner freely and with a fixed ratio", () => {
    const free = dragCorner(FULL, "se", 0.6, 0.4, null, 1.5);
    close(free.w, 0.6);
    close(free.h, 0.4);
    const sq = dragCorner(FULL, "nw", 0.5, 0.5, 1, 1.5);
    close(sq.x + sq.w, 1);
    close(sq.y + sq.h, 1);
    close((sq.w * 1.5) / sq.h, 1);
  });
});

describe("render sizes", () => {
  it("swaps width and height when rotated", () => {
    expect(editedSize(6000, 4000, { rotate: 90, flipH: false, straighten: 0, crop: FULL, aspect: "free" })).toEqual({ w: 4000, h: 6000 });
  });
  it("caps output for phones", () => {
    const s = fitSize(8000, 6000);
    expect(s.w * s.h).toBeLessThanOrEqual(16_000_000);
    expect(fitSize(4000, 3000, 2560)).toEqual({ w: 2560, h: 1920 });
  });
  it("enlarges a straightened photo enough to hide corners", () => {
    expect(straightenScale(3, 2, 0)).toBe(1);
    expect(straightenScale(3, 2, 5)).toBeGreaterThan(1.1);
  });
});
