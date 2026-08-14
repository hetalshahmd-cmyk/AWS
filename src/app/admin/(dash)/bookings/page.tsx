import type { Metadata } from "next";
import BookingsTable from "@/components/admin/BookingsTable";
import { listBookings } from "@/lib/repo";

export const metadata: Metadata = { title: "Bookings — Admin" };
export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const bookings = await listBookings();

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Bookings</h1>
      <p className="mt-1 text-plum-soft">
        Every appointment booked from the site. Cancelling frees the slot so someone else can take
        it.
      </p>
      <BookingsTable initial={bookings} />
    </div>
  );
}
