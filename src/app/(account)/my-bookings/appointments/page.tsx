import type { Metadata } from "next";
import PatientAppointments from "@/components/auth/PatientAppointments";
import { site } from "@/lib/site";
import { loadMyBookings } from "../load";

export const metadata: Metadata = {
  title: `Appointments — ${site.name}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const { bookings } = await loadMyBookings();
  return <PatientAppointments initial={bookings} />;
}
