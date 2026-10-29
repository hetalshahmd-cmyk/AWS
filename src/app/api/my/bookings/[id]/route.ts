import { crossSiteBlocked } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { patientView } from "@/lib/models";
import { getUserSession } from "@/lib/auth";
import { sendCancellation } from "@/lib/appointment-emails";
import { BookingInPastError, cancelUserBooking } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Patients can only cancel — never resurrect — and only their own bookings. */
export async function PATCH(request: Request, ctx: Ctx) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { id } = await ctx.params;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status !== "cancelled") {
    return NextResponse.json(
      { error: "Call the office to rebook a cancelled appointment" },
      { status: 400 },
    );
  }

  try {
    const result = await cancelUserBooking(id, session.id, session.email);
    if (!result) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (result.changed) await sendCancellation(result.booking);
    return NextResponse.json({ booking: patientView(result.booking) });
  } catch (error) {
    if (error instanceof BookingInPastError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("cancel failed", error);
    return NextResponse.json({ error: "Could not cancel the booking" }, { status: 503 });
  }
}
