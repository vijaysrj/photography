// Renders the app icons (home screen, Apple touch icon) from one SVG. Run: npm run icons
import { chromium } from "@playwright/test";

const mark = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" fill="#0f0e0c"/>
<g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
<rect x="96" y="96" width="320" height="320" fill="none" stroke="#c9a96e" stroke-width="22"/>
<rect x="150" y="150" width="212" height="212" fill="#c9a96e" opacity=".18"/>
<path d="M150 330l62-80 44 52 36-36 70 64z" fill="#c9a96e"/><circle cx="300" cy="200" r="20" fill="#e0c48f"/>
</g></svg>`;

const out = [
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/icon-maskable-512.png", 512, 60],
  ["src/app/apple-icon.png", 180, 20],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, pad] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>*{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${mark(pad)}`);
  await page.screenshot({ path: file });
}
await browser.close();
console.log("icons written");
