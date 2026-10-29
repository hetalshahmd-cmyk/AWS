import { requireAdminPage } from "@/lib/auth";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookingDetail from "@/components/admin/BookingDetail";
import { getBookingById } from "@/lib/repo";

export const metadata: Metadata = { title: "Booking — Admin" };
export const dynamic = "force-dynamic";

/** One booking with the patient's pre-visit check-in, for the front desk. */
export default async function AdminBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const booking = await getBookingById(id).catch(() => null);
  if (!booking) notFound();
  return <BookingDetail booking={booking} backHref="/admin/bookings" backLabel="All bookings" />;
}
