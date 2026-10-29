import { crossSiteBlocked } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { sendCancellation } from "@/lib/appointment-emails";
import { BookingInPastError, cancelBookingById, getBookingByToken } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/** PATCH — cancel via the signed link from the patient's email. */
export async function PATCH(request: Request, ctx: Ctx) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  const current = await getBookingByToken((await ctx.params).token).catch(() => null);
  if (!current) return NextResponse.json({ error: "This link isn't valid" }, { status: 404 });
  const id = current.id;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.status !== "cancelled") {
    return NextResponse.json({ error: "Only cancelling is supported" }, { status: 400 });
  }

  try {
    const result = await cancelBookingById(id);
    if (!result) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (result.changed) await sendCancellation(result.booking);
    // Only the outcome: a link holder never gets the patient's record back.
    return NextResponse.json({ status: result.booking.status });
  } catch (error) {
    if (error instanceof BookingInPastError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("token cancel failed", error);
    return NextResponse.json({ error: "Could not cancel the booking" }, { status: 503 });
  }
}
