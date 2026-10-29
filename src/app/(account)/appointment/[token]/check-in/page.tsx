import type { Metadata } from "next";
import Link from "next/link";
import CheckInForm from "@/components/appointment/CheckInForm";
import { LangProvider } from "@/components/lang-context";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { getBookingByToken, hasStarted } from "@/lib/repo";

export const metadata: Metadata = {
  title: "Pre-visit check-in — Arizona Women Specialists",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Pre-visit check-in, reached from the appointment page or the emails. Open
 * only while the appointment is confirmed and still ahead.
 */
export default async function CheckInPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Forged, unknown and expired links all read as "not valid".
  const booking = await getBookingByToken(token).catch(() => null);
  const lang = await getLang(booking?.lang ?? "en");
  const tr = t(lang);
  const open = booking?.status === "confirmed" && !hasStarted(booking);
  const intake = booking?.intake;

  return (
    <div className="min-h-full bg-ivory">
      <div className="mx-auto w-full max-w-3xl px-[clamp(20px,5vw,48px)] py-[clamp(2.5rem,6vw,4.5rem)]">
        {!booking ? (
          <p className="rounded-[20px] border border-mist bg-white p-6 text-plum-soft">{tr.linkInvalid}</p>
        ) : !open ? (
          <div className="rounded-[20px] border border-mist bg-white p-6 text-plum-soft">
            <p>{tr.checkInClosed}</p>
            <Link href={`/appointment/${token}`} className="focus-ring mt-3 inline-block font-medium text-wine link-underline">
              {tr.backToAppointment}
            </Link>
          </div>
        ) : (
          <LangProvider initial={lang}>
            <CheckInForm
              token={token}
              hasInsurance={Boolean(booking.insurance)}
              initial={{
                phone: intake?.phone ?? "",
                street: intake?.street ?? "",
                city: intake?.city ?? "",
                state: intake?.state ?? "AZ",
                zip: intake?.zip ?? "",
                emergencyName: intake?.emergencyName ?? "",
                emergencyPhone: intake?.emergencyPhone ?? "",
                memberId: intake?.memberId ?? "",
                groupNumber: intake?.groupNumber ?? "",
                allergies: intake?.allergies ?? "",
                medications: intake?.medications ?? "",
                conditions: intake?.conditions ?? "",
                surgeries: intake?.surgeries ?? "",
                lmp: intake?.lmp ?? "",
                pregnant: intake?.pregnant ?? "",
                pregnancies: intake?.pregnancies ?? "",
                hasCardFront: Boolean(intake?.cardFrontId),
                hasCardBack: Boolean(intake?.cardBackId),
                hasPhotoId: Boolean(intake?.photoIdId),
                submitted: Boolean(intake?.submittedAt),
              }}
            />
          </LangProvider>
        )}
      </div>
    </div>
  );
}
