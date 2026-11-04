import { NextResponse } from "next/server";
import { teamRoute } from "@/lib/api-helpers";
import { listBookings } from "@/lib/repo";
import type { BookingStatus } from "@/lib/models";

export const dynamic = "force-dynamic";

export const GET = teamRoute(async (request) => {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("status");
  const status = raw === "confirmed" || raw === "cancelled" ? (raw as BookingStatus) : undefined;
  return NextResponse.json({ bookings: await listBookings(status) });
});
