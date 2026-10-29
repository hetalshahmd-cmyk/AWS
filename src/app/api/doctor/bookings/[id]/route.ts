import { NextResponse } from "next/server";
import { readJson, staffRoute } from "@/lib/api-helpers";
import { sendCancellation } from "@/lib/appointment-emails";
import { BookingInPastError, cancelBookingById, getBookingById } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH { status: "cancelled" } — a provider cancels one of their own visits. */
export const PATCH = staffRoute(async (request, staff, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await readJson<{ status?: string }>(request);
  if (body.status !== "cancelled") {
    return NextResponse.json({ error: "Only cancelling is supported" }, { status: 400 });
  }
  const booking = await getBookingById(id).catch(() => null);
  if (!booking || (staff.role === "provider" && booking.providerId !== staff.providerId)) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  try {
    const result = await cancelBookingById(id);
    if (!result) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (result.changed) await sendCancellation(result.booking);
    return NextResponse.json({ booking: result.booking });
  } catch (error) {
    if (error instanceof BookingInPastError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
});
