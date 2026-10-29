import type { Metadata } from "next";
import AppointmentView from "@/components/appointment/AppointmentView";
import { LangProvider } from "@/components/lang-context";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getBookingByToken } from "@/lib/repo";

export const metadata: Metadata = {
  title: "Your appointment — Arizona Women Specialists",
  // Personal links from emails must never be indexed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * One appointment, reached from the link in the patient's emails or the
 * booking confirmation — no sign-in needed; the signed link is the key.
 */
export default async function AppointmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Forged, unknown and expired links all read as "not valid".
  const booking = await getBookingByToken(token).catch(() => null);
  const lang = await getLang(booking?.lang ?? "en");

  return (
    <div className="min-h-full bg-ivory">
      <div className="mx-auto w-full max-w-3xl px-[clamp(20px,5vw,48px)] py-[clamp(2.5rem,6vw,4.5rem)]">
        {booking ? (
          <LangProvider initial={lang}>
            <AppointmentView
              token={token}
              view={{
                id: booking.id,
                date: booking.date,
                time: booking.time,
                reason: booking.reason,
                status: booking.status,
                providerId: booking.providerId,
                officeId: booking.officeId,
                firstName: booking.patient.firstName,
                checkedIn: Boolean(booking.intake?.submittedAt),
              }}
            />
          </LangProvider>
        ) : (
          <p className="rounded-[20px] border border-mist bg-white p-6 text-plum-soft">
            {t(lang).linkInvalid}
          </p>
        )}
      </div>
    </div>
  );
}
