import { readProviderPhoto } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

/** A provider's uploaded headshot. Public — it is shown on the website. */
export async function GET(_request: Request, ctx: Ctx) {
  const photo = await readProviderPhoto((await ctx.params).id).catch(() => null);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      // A new upload gets a new id, so a stored copy never goes stale.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
