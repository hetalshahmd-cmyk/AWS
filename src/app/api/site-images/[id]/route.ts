import { readSiteImage } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

/** A picture uploaded in Admin → Site content. Public — it is shown on the website. */
export async function GET(_request: Request, ctx: Ctx) {
  const image = await readSiteImage((await ctx.params).id).catch(() => null);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      // A new upload gets a new id, so a stored copy never goes stale.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
