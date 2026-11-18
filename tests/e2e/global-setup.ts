import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Makes test photos: a 6000×4000 noisy JPEG (~20 MB, so it uploads in several parts) and a small one. */
export default async function globalSetup() {
  const dir = path.resolve(".e2e");
  fs.mkdirSync(dir, { recursive: true });
  const want = [
    { file: "big.jpg", w: 6000, h: 4000, q: 0.97 },
    { file: "small.jpg", w: 1200, h: 800, q: 0.9 },
  ].filter((f) => !fs.existsSync(path.join(dir, f.file)));
  if (!want.length) return;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const f of want) {
    const b64 = await page.evaluate(async ({ w, h, q }) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const y = Math.floor(i / 4 / w);
        img.data[i] = (Math.random() * 120 + y / 30) | 0;
        img.data[i + 1] = (Math.random() * 90 + 40) | 0;
        img.data[i + 2] = (Math.random() * 60 + 20) | 0;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", q));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, f);
    fs.writeFileSync(path.join(dir, f.file), Buffer.from(b64, "base64"));
  }
  await browser.close();
}
