import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { cancelUserBooking } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Patients can only cancel — never resurrect — and only their own bookings. */
export async function PATCH(request: Request, ctx: Ctx) {
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
    const booking = await cancelUserBooking(id, session.id, session.email);
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    return NextResponse.json({ booking });
  } catch (error) {
    console.error("cancel failed", error);
    return NextResponse.json({ error: "Could not cancel the booking" }, { status: 503 });
  }
}
