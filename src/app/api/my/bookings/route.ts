import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { manageToken } from "@/lib/booking-links";
import { patientView } from "@/lib/models";
import { listUserBookings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  try {
    const bookings = await listUserBookings(session.id, session.email);
    // Each booking carries its signed link, used for reschedule and check-in.
    return NextResponse.json({
      bookings: bookings.map((booking) => ({ ...patientView(booking), manageToken: manageToken(booking.id) })),
    });
  } catch (error) {
    console.error("my bookings failed", error);
    return NextResponse.json({ error: "Could not load your bookings" }, { status: 503 });
  }
}
