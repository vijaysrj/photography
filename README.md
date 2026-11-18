# Photography

A stylish, low-cost home for your photographs: a private studio to upload, view and
manage full-resolution work, and (in later steps) a public portfolio with in-browser
editing, sharing and framed previews that buyers can enquire about.

It's one web app that works on phones and desktops. On your phone, open the site and
choose **Add to Home Screen** to use the studio like an app.

![Public site](docs/screenshots/home.png)

## What's in step 1

- **Private studio** at `/studio`, behind your password.
- **Full-resolution uploads** straight from your browser to Cloudflare R2, in 16 MB parts,
  4 at a time, with automatic retries. If the connection drops or you close the tab,
  choose the same file again and it carries on where it stopped.
- **Originals are never changed.** Your browser also makes three web-sized copies
  (480, 1280 and 2560 px) for fast browsing, so the server never has to open huge files.
- **Camera details** (camera, lens, focal length, aperture, shutter, ISO, date) are read
  from the file. Location (GPS) is never read or stored.
- **Library** with a storage meter against R2's free 10 GB, a photo page with download
  of the original, rename and delete.

## What's in step 2

- **Public portfolio** at `/`: a full-bleed hero, your public albums, and a gallery of
  public photos. Until something is public, it shows a "coming soon" page.
- **Three levels of sharing** for every photo and album: **Private** (only you),
  **Link only** (anyone with the secret `/s/…` link, never listed or indexed) and
  **Public** (shown on your site). Copy or share the link straight from the studio, and
  make a new link if one went to the wrong person (the old one stops working).
- **Albums**: create, add photos from your library, reorder, choose a cover, describe the
  series. Anyone who can open an album sees every photo in it.
- **Select many** in the library to make them public, link only or private, or add them to
  an album in one go.
- **Full-screen viewer**: swipe or use arrow keys, pinch, double-tap or scroll to zoom,
  drag to pan, swipe down or Escape to close. The open photo is in the address, so links
  can point straight at it.
- **Link previews**: shared links show the photo, title and caption in WhatsApp,
  iMessage and social apps.
- Visitors only ever get the 2560 px web copy. Originals stay private.

## What's in step 3

- **In-browser editor** (`Edit` on any photo in the studio), on phone and desktop:
  - **Presets**: Vivid, Golden, Matte, Film, Cool, Drama, Soft, Mono, Noir, Silver, each
    previewed on your own photo.
  - **Light**: exposure, contrast, highlights, shadows, fade, vignette.
  - **Colour**: warmth, tint, saturation, vibrance, black and white.
  - **Crop**: free or fixed shapes including print ratios (4:5, 5:7, 2:3, 3:4), rotate,
    flip and straighten. Drag the box or its corners.
  - **Hold to compare** with the photo as shot; double-click any slider label to reset it.
- **Non-destructive**: edits are saved as a small recipe. Your original file is never
  changed, you can reopen the editor and carry on, or go **Back to original** any time.
- **Download edited** renders the edited photo at full resolution as a JPEG (capped at about
  16 MP on phones, which can't make bigger images).
- All the image work happens on your device, so editing costs nothing to host.

![Editor](docs/screenshots/editor.png)

## How it's built (and why it's cheap)

| Piece | Service | Cost at small scale |
| --- | --- | --- |
| App | Next.js on Vercel | Free (Hobby), see note below |
| Photo files | Cloudflare R2 | Free up to 10 GB, then about $0.015/GB a month. No charge for views/downloads |
| Photo details | Postgres on Neon | Free tier |

Files go from your browser directly to R2 using short-lived signed links. They never
pass through the app server, which keeps it fast and inside free limits.

> **Note on Vercel's free plan:** Hobby is for non-commercial use. Your private studio is
> fine there. Before the public shop goes live, we'll decide between Vercel Pro
> ($20/month) or moving hosting to Cloudflare, which allows commercial use on its free plan.

## Setting it up

You'll need free accounts on Cloudflare, Neon and Vercel. Takes about 20 minutes.

### 1. Cloudflare R2 (photo storage)

1. In the Cloudflare dashboard, open **R2 Object Storage** and enable it (a card is
   required even on the free allowance).
2. **Create bucket** named `photography`. Leave it private (no public access).
3. Open the bucket → **Settings** → **CORS policy** → **Edit**, and paste (put your real
   site address in place of `https://your-site.vercel.app`):
   ```json
   [
     {
       "AllowedOrigins": ["https://your-site.vercel.app", "http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   `ExposeHeaders: ETag` matters: without it, large uploads can't finish.
4. Back on the R2 overview, **Manage R2 API tokens** → **Create API token** with
   **Object Read & Write**, limited to the `photography` bucket. Note the
   **Access Key ID**, **Secret Access Key**, and your **Account ID**.

### 2. Neon (database)

1. Create a project at neon.tech (pick the region closest to you, e.g. Singapore or Mumbai).
2. Copy the **pooled** connection string. That's your `DATABASE_URL`.

### 3. Vercel (hosting)

1. **Add New → Project**, import this GitHub repository.
2. Under **Environment Variables**, add everything from [`.env.example`](.env.example):
   `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
   Make `SESSION_SECRET` with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Deploy. The database tables are created automatically on each deploy.
4. Add your Vercel address to the R2 CORS policy (step 1.3) if you hadn't yet.
5. Open `/studio`, sign in with your `ADMIN_PASSWORD`, and upload.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run db:migrate
npm run dev                  # http://localhost:3000
```

## Running the tests

```bash
npm test          # unit tests
npm run e2e       # browser tests (desktop + phone)
```

The browser tests need a Postgres database and an S3-compatible stand-in for R2
(for example [moto](https://github.com/getmoto/moto): `moto_server -p 4566`, then create a
`photography` bucket with the CORS rule above). Point `.env.local` at them with
`R2_ENDPOINT=http://localhost:4566`, then `npm run build && npm run e2e`.

## Where things live

- `src/lib/upload/` — upload engine (part planning, resume, retries) and browser-side image copies
- `src/lib/storage.ts` — R2 access and signed links
- `src/lib/db/` — database tables (`npm run db:generate` after changing `schema.ts`)
- `src/lib/auth/` and `src/proxy.ts` — studio login
- `src/app/studio/` — studio pages; `src/app/api/uploads/` — upload API
- `src/lib/site.ts` — site name and wording
