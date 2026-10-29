import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookingDetail from "@/components/admin/BookingDetail";
import { getCurrentAdmin } from "@/lib/auth";
import { getBookingById } from "@/lib/repo";

export const metadata: Metadata = { title: "Appointment — Provider" };
export const dynamic = "force-dynamic";

/** One of the provider's own appointments, with the patient's check-in. */
export default async function DoctorBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [staff, booking] = await Promise.all([
    getCurrentAdmin().catch(() => null),
    getBookingById(id).catch(() => null),
  ]);
  // Someone else's patient looks exactly like a missing one.
  if (!booking || !staff || booking.providerId !== staff.providerId) notFound();
  return <BookingDetail booking={booking} backHref="/admin/doctor" backLabel="My appointments" />;
}
