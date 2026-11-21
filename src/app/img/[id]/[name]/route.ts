import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isOwner } from "@/lib/auth/session";
import { signView } from "@/lib/storage";
import { isViewSize, pickVariant } from "@/lib/view-links";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Anyone may see a photo that is public or unlisted, or that sits in a shared album. */
async function sharedWithVisitors(photo: typeof schema.photos.$inferSelect) {
  if (photo.visibility !== "private") return true;
  const [inSharedAlbum] = await db()
    .select({ id: schema.albums.id })
    .from(schema.albumPhotos)
    .innerJoin(schema.albums, eq(schema.albumPhotos.albumId, schema.albums.id))
    .where(and(eq(schema.albumPhotos.photoId, photo.id), ne(schema.albums.visibility, "private")))
    .limit(1);
  return !!inSharedAlbum;
}

/**
 * Sends the browser on to a fresh signed storage link for one web copy of a photo.
 * Shared photos are cached at Vercel's edge for an hour (signed links last at
 * least six), so most visits never reach this code. Private photos are only
 * sent to you, and are never cached at the edge.
 */
export async function GET(_req: Request, ctx: RouteContext<"/img/[id]/[name]">) {
  const { id, name } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !isViewSize(name)) return notFound();

  const [photo] = await db()
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.id, id), eq(schema.photos.status, "ready")));
  const variant = photo && pickVariant(photo, name);
  if (!photo || !variant) return notFound();

  let cache: string;
  if (await sharedWithVisitors(photo)) cache = "public, max-age=3600, s-maxage=3600";
  else if (await isOwner()) cache = "private, max-age=3600";
  else return notFound();

  return new Response(null, { status: 302, headers: { Location: await signView(variant.key), "Cache-Control": cache } });
}
