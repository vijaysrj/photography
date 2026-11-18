import { applyAdjustments } from "./adjust";
import type { Edits, Geometry } from "./types";

/**
 * Browser-side renderer: applies a photo's recipe (crop, rotation, light, colour)
 * to an image and returns a canvas. Used for the live preview, for the web copies
 * saved after editing, and for full-size downloads.
 */

/** iPhones refuse canvases over ~16.7 million pixels, so full-size output is capped just under. */
export const MAX_CANVAS_PIXELS = 16_000_000;

export function rotatedSize(w: number, h: number, rotate: Geometry["rotate"]) {
  return rotate === 90 || rotate === 270 ? { w: h, h: w } : { w, h };
}

/** How much to enlarge a straightened photo so no empty corners show. */
export function straightenScale(w: number, h: number, degrees: number) {
  const t = Math.abs((degrees * Math.PI) / 180);
  return Math.cos(t) + Math.sin(t) * (Math.max(w, h) / Math.min(w, h));
}

/** Pixel size of the edited result at full resolution. */
export function editedSize(srcW: number, srcH: number, g: Geometry) {
  const r = rotatedSize(srcW, srcH, g.rotate);
  return { w: Math.max(1, Math.round(r.w * g.crop.w)), h: Math.max(1, Math.round(r.h * g.crop.h)) };
}

export function fitSize(w: number, h: number, longEdge?: number, maxPixels = MAX_CANVAS_PIXELS) {
  let s = 1;
  if (longEdge) s = Math.min(s, longEdge / Math.max(w, h));
  s = Math.min(s, Math.sqrt(maxPixels / (w * h)));
  return { w: Math.max(1, Math.floor(w * s + 1e-6)), h: Math.max(1, Math.floor(h * s + 1e-6)) };
}

export type RenderOptions = {
  longEdge?: number; // limit the output size
  ignoreCrop?: boolean; // the crop tool shows the whole frame
  geometryOnly?: boolean; // skip light and colour (used for "before")
};

export function renderEdited(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  edits: Edits,
  opts: RenderOptions = {},
): HTMLCanvasElement {
  const g = opts.ignoreCrop ? { ...edits.geometry, crop: { x: 0, y: 0, w: 1, h: 1 } } : edits.geometry;
  const frame = rotatedSize(srcW, srcH, g.rotate);
  const full = editedSize(srcW, srcH, g);
  const out = fitSize(full.w, full.h, opts.longEdge);
  const k = out.w / full.w;

  const canvas = document.createElement("canvas");
  canvas.width = out.w;
  canvas.height = out.h;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error("This device couldn't create an image that large.");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, out.w, out.h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.scale(k, k);
  ctx.translate(-g.crop.x * frame.w, -g.crop.y * frame.h);
  ctx.translate(frame.w / 2, frame.h / 2);
  if (g.straighten) {
    ctx.rotate((g.straighten * Math.PI) / 180);
    const s = straightenScale(frame.w, frame.h, g.straighten);
    ctx.scale(s, s);
  }
  if (g.flipH) ctx.scale(-1, 1);
  if (g.rotate) ctx.rotate((g.rotate * Math.PI) / 180);
  ctx.drawImage(source, -srcW / 2, -srcH / 2, srcW, srcH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (!opts.geometryOnly) {
    const img = ctx.getImageData(0, 0, out.w, out.h);
    applyAdjustments(img.data, out.w, out.h, edits.adjust, edits.mono);
    ctx.putImageData(img, 0, 0);
  }
  return canvas;
}

/** Draws a canvas smaller (used to make the medium and thumbnail copies from the large one). */
export function downscale(src: HTMLCanvasElement, longEdge: number): HTMLCanvasElement {
  const { w, h } = fitSize(src.width, src.height, longEdge);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality));
}

/** Opens an image from a link (an R2 signed URL) as a bitmap, upright. */
export async function loadBitmap(url: string, signal?: AbortSignal): Promise<ImageBitmap> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Couldn't load the image (${res.status})`);
  return createImageBitmap(await res.blob(), { imageOrientation: "from-image" });
}
