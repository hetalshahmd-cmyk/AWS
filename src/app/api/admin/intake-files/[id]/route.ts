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
export const GET = staffRoute(async (_request, staff, ctx: Ctx) => {
  const photo = await readPhoto((await ctx.params).id);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (staff.role === "provider") {
    const booking = await getBookingById(photo.bookingId).catch(() => null);
    if (!booking || booking.providerId !== staff.providerId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
