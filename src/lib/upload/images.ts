/**
 * Runs in the browser. Makes the small web copies of a photo and reads its camera
 * details, so the server never has to open huge files (which keeps hosting free).
 */

export type MadeVariant = { name: "thumb" | "medium" | "large"; blob: Blob; width: number; height: number };
export type ImageInfo = {
  width: number;
  height: number;
  dominantColor: string;
  type: "image/webp" | "image/jpeg";
  variants: MadeVariant[];
};

const SIZES = { large: 2560, medium: 1280, thumb: 480 } as const;
const QUALITY = { large: 0.86, medium: 0.84, thumb: 0.8 } as const;

let webpSupport: Promise<boolean> | null = null;
function canEncodeWebp(): Promise<boolean> {
  webpSupport ??= new Promise((resolve) => {
    const c = document.createElement("canvas");
    c.width = c.height = 2;
    c.toBlob((b) => resolve(!!b && b.type === "image/webp"), "image/webp", 0.8);
  });
  return webpSupport;
}

function fit(w: number, h: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

function draw(source: CanvasImageSource, sw: number, sh: number, longEdge: number) {
  const { width, height } = fit(sw, sh, longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality),
  );
}

function averageColor(canvas: HTMLCanvasElement): string {
  const one = document.createElement("canvas");
  one.width = one.height = 1;
  const ctx = one.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Returns null when this browser can't open the format (for example HEIC outside Safari). */
export async function makeVariants(file: Blob): Promise<ImageInfo | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const type = (await canEncodeWebp()) ? "image/webp" : "image/jpeg";
    const { width, height } = bitmap;
    const large = draw(bitmap, width, height, SIZES.large);
    bitmap.close();
    // Each smaller size is drawn from the one above it: faster and sharper.
    const medium = draw(large, large.width, large.height, SIZES.medium);
    const thumb = draw(medium, medium.width, medium.height, SIZES.thumb);
    const canvases = { large, medium, thumb };
    const variants: MadeVariant[] = [];
    for (const name of ["thumb", "medium", "large"] as const) {
      const c = canvases[name];
      variants.push({ name, blob: await toBlob(c, type, QUALITY[name]), width: c.width, height: c.height });
    }
    return { width, height, type, dominantColor: averageColor(thumb), variants };
  } catch {
    bitmap.close();
    return null;
  }
}

export type CameraInfo = {
  takenAt?: string;
  exif: { make?: string; model?: string; lens?: string; focalLength?: number; aperture?: number; exposureTime?: number; iso?: number };
};

/** Reads camera settings. Location (GPS) is never read or stored. */
export async function readCameraInfo(file: Blob): Promise<CameraInfo> {
  try {
    const exifr = (await import("exifr")).default;
    const t = await exifr.parse(file, {
      gps: false,
      pick: ["Make", "Model", "LensModel", "FocalLength", "FNumber", "ExposureTime", "ISO", "DateTimeOriginal"],
    });
    if (!t) return { exif: {} };
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : undefined);
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    const date = t.DateTimeOriginal instanceof Date && !isNaN(t.DateTimeOriginal.getTime()) ? t.DateTimeOriginal.toISOString() : undefined;
    return {
      takenAt: date,
      exif: {
        make: str(t.Make),
        model: str(t.Model),
        lens: str(t.LensModel),
        focalLength: num(t.FocalLength),
        aperture: num(t.FNumber),
        exposureTime: num(t.ExposureTime),
        iso: num(t.ISO),
      },
    };
  } catch {
    return { exif: {} };
  }
}
