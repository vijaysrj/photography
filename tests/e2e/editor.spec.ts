import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "test-password-123";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Open the studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
}

/** Size of the shown photo, and whether its centre pixel is grey (black and white). */
async function shownImage(page: Page, name: string) {
  const img = page.getByRole("img", { name });
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  return img.evaluate(async (i: HTMLImageElement) => {
    const bmp = await createImageBitmap(await (await fetch(i.currentSrc)).blob());
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const [r, g, b] = ctx.getImageData(Math.floor(bmp.width / 2), Math.floor(bmp.height / 2), 1, 1).data;
    return { w: bmp.width, h: bmp.height, grey: Math.abs(r - g) < 4 && Math.abs(g - b) < 4 };
  });
}

test.describe.configure({ mode: "serial" });

test("edit a photo: black and white, square crop, then undo it all", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("file-input").setInputFiles(".e2e/small.jpg");
  await expect(page.locator('li[data-phase="done"]')).toHaveCount(1, { timeout: 60_000 });
  await page.locator('a[href^="/studio/photos/"]').first().click();
  await expect(page).toHaveURL(/\/studio\/photos\/[0-9a-f-]{36}$/);
  const photoUrl = page.url();

  const before = await shownImage(page, "small");
  expect(before).toMatchObject({ w: 1200, h: 800, grey: false });

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  const editor = page.getByTestId("editor");
  await expect(editor.getByTestId("preview")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Save" })).toBeDisabled();

  await editor.getByRole("button", { name: "Mono", exact: true }).click();
  await editor.getByRole("tab", { name: "Light" }).click();
  await expect(editor.getByLabel("Contrast")).toHaveValue("15");
  await editor.getByRole("tab", { name: "Crop" }).click();
  await editor.getByRole("button", { name: "Square" }).click();
  await expect(editor.getByTestId("crop-box")).toBeVisible();
  await editor.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(photoUrl, { timeout: 30_000 });
  await expect(page.getByText("Edited · the original is untouched")).toBeVisible();
  await expect.poll(async () => (await shownImage(page, "small")).w).toBe(800);
  const edited = await shownImage(page, "small");
  expect(edited).toMatchObject({ w: 800, h: 800, grey: true });

  // The original is still the original.
  const href = await page.getByRole("link", { name: "Download original" }).getAttribute("href");
  expect((await (await page.request.get(href!)).body()).length).toBe(fs.statSync(".e2e/small.jpg").size);

  // Full-size edited download.
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download edited" }).click();
  expect((await dl).suggestedFilename()).toBe("small-edited.jpg");

  // Re-opening the editor remembers the recipe.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("tab", { name: "Colour" }).click();
  await expect(page.getByLabel("Black and white")).toBeChecked();
  await page.getByRole("link", { name: "Cancel" }).click();

  // Back to original.
  await page.getByRole("button", { name: "Back to original" }).click();
  await page.getByRole("button", { name: "Undo all edits" }).click();
  await expect(page.getByText("Edited · the original is untouched")).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await shownImage(page, "small")).w).toBe(1200);
  expect(await shownImage(page, "small")).toMatchObject({ w: 1200, h: 800, grey: false });

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete forever" }).click();
  await expect(page).toHaveURL(/\/studio$/);
});

test("rotate, then drag the crop corner by hand", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("file-input").setInputFiles(".e2e/small.jpg");
  await expect(page.locator('li[data-phase="done"]')).toHaveCount(1, { timeout: 60_000 });
  await page.locator('a[href^="/studio/photos/"]').first().click();
  await expect(page).toHaveURL(/\/studio\/photos\/[0-9a-f-]{36}$/);
  const photoUrl = page.url();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("tab", { name: "Crop" }).click();
  await page.getByRole("button", { name: "Rotate ⟲" }).click();

  const box = page.getByTestId("crop-box");
  await expect.poll(async () => { const b = (await box.boundingBox())!; return b.height > b.width; }).toBe(true);
  const b = (await box.boundingBox())!;
  const handle = (await page.getByTestId("crop-se").boundingBox())!;
  await page.mouse.move(handle.x + handle.width - 2, handle.y + handle.height - 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(photoUrl, { timeout: 30_000 });
  await expect.poll(async () => (await shownImage(page, "small")).w).toBeLessThan(800);
  const { w, h } = await shownImage(page, "small");
  expect(Math.abs(w - 400)).toBeLessThan(25); // half of the rotated 800 px width
  expect(Math.abs(h - 600)).toBeLessThan(25);

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete forever" }).click();
  await expect(page).toHaveURL(/\/studio$/);
});
