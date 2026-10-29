import type { Metadata } from "next";
import PatientOverview from "@/components/auth/PatientOverview";
import { site } from "@/lib/site";
import { loadMyBookings } from "./load";

export const metadata: Metadata = {
  title: `My appointments — ${site.name}`,
  description: "Your appointments, check-ins and providers.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const { user, bookings } = await loadMyBookings();
  return (
    <PatientOverview firstName={user?.name.trim().split(/\s+/)[0] ?? ""} initial={bookings} />
  );
}
