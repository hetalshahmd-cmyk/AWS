import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookingDetail from "@/components/admin/BookingDetail";
import { requireTeamPage } from "@/lib/auth";
import { getBookingById } from "@/lib/repo";

export const metadata: Metadata = { title: "Booking — Front desk" };
export const dynamic = "force-dynamic";

export default async function TeamBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeamPage();
  const booking = await getBookingById((await params).id).catch(() => null);
  if (!booking) notFound();
  return <BookingDetail booking={booking} backHref="/admin/team/bookings" backLabel="All bookings" canEmail />;
}
