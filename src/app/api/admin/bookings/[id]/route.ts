import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { deleteBooking, setBookingStatus } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = adminRoute(async (request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await readJson<{ status?: string }>(request);

  if (body.status !== "confirmed" && body.status !== "cancelled") {
    return NextResponse.json({ error: "Status must be confirmed or cancelled" }, { status: 400 });
  }

  const booking = await setBookingStatus(id, body.status);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json({ booking });
});

export const DELETE = adminRoute(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const ok = await deleteBooking(id);
  if (!ok) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
