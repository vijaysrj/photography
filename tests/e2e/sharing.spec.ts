import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = process.env.ADMIN_PASSWORD ?? "test-password-123";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Open the studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
}

async function upload(page: Page, files: string[]) {
  await page.getByTestId("file-input").setInputFiles(files);
  await expect(page.locator('li[data-phase="done"]')).toHaveCount(files.length, { timeout: 60_000 });
  await expect(page.locator('a[href^="/studio/photos/"]')).toHaveCount(files.length);
}

/** Clicks something that saves in the studio, and waits until the save has finished. */
async function save(page: Page, click: () => Promise<void>) {
  const done = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
  await click();
  await done;
}

/** A visitor with no login. */
async function visitor(browser: Browser) {
  const ctx = await browser.newContext();
  return { page: await ctx.newPage(), close: () => ctx.close() };
}

async function deleteAll(page: Page) {
  await page.goto("/studio");
  while ((await page.locator('a[href^="/studio/photos/"]').count()) > 0) {
    await page.locator('a[href^="/studio/photos/"]').first().click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete forever" }).click();
    await expect(page).toHaveURL(/\/studio$/);
  }
  await page.goto("/studio/albums");
  while ((await page.locator('a[href^="/studio/albums/"]').count()) > 0) {
    await page.locator('a[href^="/studio/albums/"]').first().click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete forever" }).click();
    await expect(page).toHaveURL(/\/studio\/albums$/);
  }
}

test.describe.configure({ mode: "serial" });

test("photos are private until you share them, by link or publicly", async ({ page, browser }) => {
  await signIn(page);
  await upload(page, [".e2e/small.jpg", ".e2e/tall.jpg"]);

  // Private by default: nothing on the public site.
  const v = await visitor(browser);
  await v.page.goto("/");
  await expect(v.page.getByText("The gallery is being hung")).toBeVisible();

  // Link only: a secret link works for anyone, but nothing is listed.
  await page.locator('a[href^="/studio/photos/"]').first().click();
  await expect(page).toHaveURL(/\/studio\/photos\/[0-9a-f-]{36}$/);
  const photoUrl = page.url();
  const photoId = photoUrl.split("/").pop()!;
  await save(page, () => page.getByRole("radio", { name: "Link only" }).click());
  const share = page.getByTestId("share-url");
  await expect(share).toHaveValue(/\/s\/[A-Za-z0-9_-]{20,}$/);
  const secret = await share.inputValue();
  await v.page.goto(secret);
  await expect(v.page.getByRole("img").first()).toBeVisible();
  await v.page.goto(`/photos/${photoId}`);
  await expect(v.page.getByText("Nothing hangs here")).toBeVisible();

  // A new link turns the old one off.
  await page.getByRole("button", { name: /Make a new link/ }).click();
  await page.getByRole("button", { name: "Make a new link" }).click();
  await expect(share).not.toHaveValue(secret);
  await v.page.goto(secret);
  await expect(v.page.getByText("Nothing hangs here")).toBeVisible();

  // Public: listed on the home page and at its own address.
  await save(page, () => page.getByRole("radio", { name: "Public" }).click());
  await expect(share).toHaveValue(new RegExp(`/photos/${photoId}$`));
  await v.page.goto("/");
  await expect(v.page.getByRole("button", { name: /^Open / })).toHaveCount(1);
  await v.page.goto(`/photos/${photoId}`);
  await expect(v.page.getByRole("button", { name: "View full screen" })).toBeVisible();

  // Back to private: gone again.
  await save(page, () => page.getByRole("radio", { name: "Private" }).click());
  await expect(share).toHaveCount(0);
  await v.page.goto(`/photos/${photoId}`);
  await expect(v.page.getByText("Nothing hangs here")).toBeVisible();
  await v.close();
});

test("select many photos, make them public, and browse them full screen", async ({ page, browser }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Select all" }).click();
  await save(page, () => page.getByRole("button", { name: "Make public" }).click());
  await expect(page.locator("a[href^='/studio/photos/'] >> text=Public")).toHaveCount(2);

  const v = await visitor(browser);
  await v.page.goto("/");
  const tiles = v.page.getByRole("button", { name: /^Open / });
  await expect(tiles).toHaveCount(2);
  await tiles.first().click();
  const dialog = v.page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("1 / 2")).toBeVisible();
  await expect(v.page).toHaveURL(/\?photo=/);
  await v.page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("2 / 2")).toBeVisible();
  await v.page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await v.close();
});

test("albums: build one, share it by link, then publish it", async ({ page, browser }) => {
  await signIn(page);
  // Make everything private first, so the album link is the only way in.
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Select all" }).click();
  await save(page, () => page.getByRole("button", { name: "Private" }).click());

  await page.goto("/studio/albums");
  await page.getByLabel("New album name").fill("Monsoon Diaries");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/studio\/albums\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Add photos" }).click();
  const picker = page.getByRole("dialog", { name: "Add photos" });
  for (const b of await picker.getByRole("button", { name: /^Select / }).all()) await b.click();
  await picker.getByRole("button", { name: "Add 2" }).click();
  await expect(page.getByText("2 photos")).toBeVisible();

  await save(page, () => page.getByRole("radio", { name: "Link only" }).click());
  const secret = await page.getByTestId("share-url").inputValue();

  const v = await visitor(browser);
  await v.page.goto(secret);
  await expect(v.page.getByRole("heading", { name: "Monsoon Diaries" })).toBeVisible();
  await expect(v.page.getByRole("button", { name: /^Open / })).toHaveCount(2);
  await v.page.goto("/");
  await expect(v.page.getByText("The gallery is being hung")).toBeVisible();

  await save(page, () => page.getByRole("radio", { name: "Public" }).click());
  await expect(page.getByTestId("share-url")).toHaveValue(/\/albums\/monsoon-diaries$/);
  await v.page.goto("/albums/monsoon-diaries");
  await expect(v.page.getByRole("heading", { name: "Monsoon Diaries" })).toBeVisible();

  await save(page, () => page.getByRole("radio", { name: "Private" }).click());
  await expect(page.getByTestId("share-url")).toHaveCount(0);
  await v.page.goto(secret);
  await expect(v.page.getByText("Nothing hangs here")).toBeVisible();
  await v.close();

  await deleteAll(page);
});
