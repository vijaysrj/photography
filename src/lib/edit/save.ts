import { canvasToBlob, downscale, loadBitmap, renderEdited } from "./render";
import { emptyEdits, isIdentity, type Edits } from "./types";

/**
 * Applies a recipe to the full-resolution original in the browser, uploads new web
 * copies, and switches the photo over. The original file is never changed.
 */
export async function saveEdits(opts: {
  photoId: string;
  edits: Edits | null;
  originalUrl: string;
  fallbackUrl: string;
  onStatus?: (s: string) => void;
}) {
  const status = opts.onStatus ?? (() => {});
  status("Opening the full-resolution original…");
  let bmp: ImageBitmap;
  try {
    bmp = await loadBitmap(opts.originalUrl);
  } catch {
    bmp = await loadBitmap(opts.fallbackUrl); // e.g. HEIC outside Safari: use the unedited large copy
  }
  status("Applying your edits…");
  await new Promise((r) => setTimeout(r, 30));
  const recipe = opts.edits && !isIdentity(opts.edits) ? opts.edits : emptyEdits();
  const large = renderEdited(bmp, bmp.width, bmp.height, recipe, { longEdge: 2560 });
  bmp.close();
  const medium = downscale(large, 1280);
  const thumb = downscale(medium, 480);
  const type = (await canvasToBlob(thumb, "image/webp", 0.8)).type === "image/webp" ? "image/webp" : "image/jpeg";
  const px = downscale(thumb, 1).getContext("2d")!.getImageData(0, 0, 1, 1).data;
  const dominantColor = "#" + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join("");

  status("Saving…");
  const prep = await fetch(`/api/photos/${opts.photoId}/edits/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type }),
  });
  const p = await prep.json().catch(() => ({}));
  if (!prep.ok) throw new Error(p.error ?? "Couldn't start saving");
  const canvases = { large, medium, thumb };
  const quality = { large: 0.88, medium: 0.85, thumb: 0.8 };
  for (const name of ["thumb", "medium", "large"] as const) {
    const blob = await canvasToBlob(canvases[name], type, quality[name]);
    const put = await fetch(p.urls[name], { method: "PUT", body: blob, headers: { "content-type": type } });
    if (!put.ok) throw new Error(`Storage refused the upload (${put.status})`);
  }
  const size = (c: HTMLCanvasElement) => ({ width: c.width, height: c.height });
  const commit = await fetch(`/api/photos/${opts.photoId}/edits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: p.version,
      type,
      edits: recipe === opts.edits ? opts.edits : null,
      dominantColor,
      variants: { thumb: size(thumb), medium: size(medium), large: size(large) },
    }),
  });
  const c = await commit.json().catch(() => ({}));
  if (!commit.ok) throw new Error(c.error ?? "Couldn't save");
}

/** Renders the edited photo at full size (up to ~16 MP on phones) and downloads it as a JPEG. */
export async function downloadEdited(opts: { edits: Edits; originalUrl: string; fallbackUrl: string; fileName: string }) {
  let bmp: ImageBitmap;
  try {
    bmp = await loadBitmap(opts.originalUrl);
  } catch {
    bmp = await loadBitmap(opts.fallbackUrl);
  }
  const canvas = renderEdited(bmp, bmp.width, bmp.height, opts.edits);
  bmp.close();
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = opts.fileName.replace(/\.[^.]+$/, "") + "-edited.jpg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return { width: canvas.width, height: canvas.height };
}
