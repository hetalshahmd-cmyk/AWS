import type { Metadata } from "next";
import EmailCenter from "@/components/admin/EmailCenter";
import { requireTeamPage } from "@/lib/auth";
import { bookingForEmail } from "@/lib/email-bookings";
import { listPatientEmails } from "@/lib/email-repo";
import { listBookings, loadProviders } from "@/lib/repo";
import { arizonaTodayIso } from "@/lib/scheduling";

export const metadata: Metadata = { title: "Email — Front desk" };
export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  await requireTeamPage();
  await loadProviders();
  const today = arizonaTodayIso();
  const [bookings, emails] = await Promise.all([listBookings("confirmed"), listPatientEmails(null)]);
  const upcoming = bookings
    .filter((booking) => booking.date >= today)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 300)
    .map(bookingForEmail);

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Email</h1>
      <p className="mt-1 max-w-[75ch] text-plum-soft">
        Write to a patient about their booking — for example when their appointment time changes. It goes straight to
        the email on the booking, and every email sent is listed here.
      </p>
      <EmailCenter bookings={upcoming} initial={emails} />
    </div>
  );
}
