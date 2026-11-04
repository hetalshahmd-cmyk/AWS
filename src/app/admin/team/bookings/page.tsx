import type { Metadata } from "next";
import BookingsTable from "@/components/admin/BookingsTable";
import { requireTeamPage } from "@/lib/auth";
import { listBookings } from "@/lib/repo";

export const metadata: Metadata = { title: "Bookings — Front desk" };
export const dynamic = "force-dynamic";

export default async function TeamBookingsPage() {
  await requireTeamPage();
  const bookings = await listBookings();
  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Bookings</h1>
      <p className="mt-1 text-plum-soft">Every appointment booked from the site. Open one to see the check-in or email the patient.</p>
      <BookingsTable initial={bookings} />
    </div>
  );
}
