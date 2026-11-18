import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "test-password-123";

async function signIn(page: Page) {
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Open the studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
}

test("the studio is private", async ({ page, request }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/login\?next=%2Fstudio/);
  const api = await request.post("/api/uploads", { data: { name: "a.jpg", type: "image/jpeg", size: 10 } });
  expect(api.status()).toBe(401);
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Open the studio" }).click();
  await expect(page.getByText("That password isn't right.")).toBeVisible();
});

test("upload a full-resolution photo, view it, and delete it", async ({ page }) => {
  await signIn(page);
  const size = fs.statSync(".e2e/big.jpg").size;
  expect(size).toBeGreaterThan(16 * 1024 * 1024); // more than one part

  await page.getByTestId("file-input").setInputFiles(".e2e/big.jpg");
  await expect(page.locator('li[data-phase="done"]')).toBeVisible({ timeout: 90_000 });

  const tile = page.locator('a[href^="/studio/photos/"]').first();
  await expect(tile.locator("img")).toBeVisible();
  await expect.poll(() => tile.locator("img").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  await tile.click();
  await expect(page.getByText("6000 × 4000")).toBeVisible();
  const img = page.getByRole("img", { name: "big" });
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(2560);

  // The original downloads byte-for-byte.
  const href = await page.getByRole("link", { name: "Download original" }).getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.ok()).toBeTruthy();
  expect((await res.body()).length).toBe(size);

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete forever" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.locator('a[href^="/studio/photos/"]')).toHaveCount(0);
});

test("an interrupted upload resumes where it stopped", async ({ page }) => {
  await signIn(page);
  const firstPart = page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes("partNumber=") && r.ok());
  await page.getByTestId("file-input").setInputFiles(".e2e/big.jpg");
  await firstPart;
  await page.goto("about:blank"); // like closing the tab mid-upload
  await page.goto("/studio");

  await page.getByTestId("file-input").setInputFiles(".e2e/big.jpg");
  await expect(page.getByText(/resumed/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('li[data-phase="done"]')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('a[href^="/studio/photos/"]')).toHaveCount(1);

  await page.locator('a[href^="/studio/photos/"]').first().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete forever" }).click();
  await expect(page.locator('a[href^="/studio/photos/"]')).toHaveCount(0);
});
