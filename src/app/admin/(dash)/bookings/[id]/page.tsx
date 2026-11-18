import { requireAdminPage } from "@/lib/auth";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import BookingDetail from "@/components/admin/BookingDetail";
import { getBookingById } from "@/lib/repo";

export const metadata: Metadata = { title: "Booking — Admin" };
export const dynamic = "force-dynamic";

/** One booking with the patient's pre-visit check-in, for the front desk. */
export default async function AdminBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  // Admins can open an archived booking from the Archive (read only there).
  const booking = await getBookingById(id, { archived: true }).catch(() => null);
  if (!booking) notFound();
  if (booking.archivedAt) {
    return (
      <div>
        <p className="mb-4 rounded-2xl border border-wine/30 bg-wine-soft px-5 py-4 text-[15px] text-wine-deep">
          <strong className="font-semibold">This booking is in the Archive.</strong> Restore it or delete it
          permanently from{" "}
          <Link href="/admin/archive" className="font-semibold underline">
            Admin → Archive
          </Link>
          .
        </p>
        <BookingDetail booking={booking} backHref="/admin/archive" backLabel="Archive" />
      </div>
    );
  }
  return <BookingDetail booking={booking} backHref="/admin/bookings" backLabel="All bookings" canEmail />;
}
