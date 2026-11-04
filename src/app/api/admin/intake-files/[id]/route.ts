import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/api-helpers";
import { readPhoto } from "@/lib/intake-files";
import { getBookingById } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — one check-in photo. Admins see any; a provider only photos from their
 * own patients' bookings. Never cached.
 */
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

export const GET = staffRoute(async (request, staff, ctx: Ctx) => {
  const photo = await readPhoto((await ctx.params).id);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (staff.role === "provider") {
    const booking = await getBookingById(photo.bookingId).catch(() => null);
    if (!booking || booking.providerId !== staff.providerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  // ?download=<name> saves the file instead of showing it. The name is cut
  // down to plain letters, numbers and dashes before it goes in the header.
  const wanted = new URL(request.url).searchParams.get("download");
  const name = wanted?.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(wanted !== null
        ? { "Content-Disposition": `attachment; filename="${name || "check-in-photo"}.${EXTENSIONS[photo.contentType] ?? "jpg"}"` }
        : {}),
    },
  });
});
