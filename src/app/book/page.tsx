import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ProfilePanel from "@/components/ProfilePanel";
import ProviderSlots from "@/components/ProviderSlots";
import { BookingProvider, type Reschedule } from "@/components/booking-context";
import { LangProvider, LanguageToggle } from "@/components/lang-context";
import { toIso } from "@/lib/availability";
import { shortDate, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang-server";
import { practice } from "@/lib/practice";
import { getBookingByToken, getOfficeHours, getProviderReasons, hasStarted } from "@/lib/repo";
import { isOfficeId, isProviderId, officeById, shortProviderName } from "@/lib/scheduling";

export const metadata: Metadata = {
  title: `Book an appointment — ${practice.name}`,
  description: `Book an appointment for free with ${practice.name}, ${practice.specialty} at ${practice.addressLine}.`,
};

// Reads the language cookie and reschedule links, so it is per-request.
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

/**
 * Open to everyone, Zocdoc-style: the providers and their real open times
 * come first. Picking a time opens that provider's form — visit reason (from
 * their own list), insurance, new or existing, then who the patient is,
 * confirmed by a signed-in account or a 6-digit emailed code.
 */
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const lang = await getLang();
  // Opening times come from this week's plan, like everything else here.
  const [hours, providerReasons] = await Promise.all([
    getOfficeHours(),
    getProviderReasons().catch(() => ({})),
  ]);
  const tr = t(lang);
  const todayIso = toIso(new Date());

  // "Book again" / "Reschedule" links pre-select the provider and office.
  const search = await searchParams;
  const first = (key: string) => {
    const value = search[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const office = first("office");
  const provider = first("provider");

  // `reschedule` carries the signed appointment link, so it works the same for
  // signed-in patients and guests. Only an upcoming, confirmed visit can move.
  const token = first("reschedule");
  let reschedule: Reschedule = null;
  if (token) {
    const target = await getBookingByToken(token).catch(() => null);
    if (target && target.status === "confirmed" && !hasStarted(target)) {
      reschedule = {
        token,
        label: [
          `${shortDate(target.date, lang)} · ${target.time.toUpperCase()}`,
          target.providerId ? shortProviderName(target.providerId) : null,
          officeById(target.officeId)?.area ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
        reason: target.reason,
        insurance: target.insurance,
        patientType: target.patientType,
      };
    }
  }

  return (
    <LangProvider initial={lang}>
      <BookingProvider
        todayIso={todayIso}
        providerReasons={providerReasons}
        // /book?office=arrowhead opens on that office's tab.
        initialOfficeId={isOfficeId(office) ? office : "any"}
        initialProviderId={isProviderId(provider) ? provider : "any"}
        initialReschedule={reschedule}
      >
        <div lang={lang} className="min-h-screen bg-cream text-ink">
          <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/"
                className="focus-ring text-[15px] font-medium text-ink-soft link-underline"
              >
                ← {practice.name}
              </Link>
              <LanguageToggle />
            </div>

            {reschedule && (
              <p
                role="status"
                className="mt-5 rounded-xl border border-teal/30 bg-teal-soft px-4 py-3 text-[15px] text-teal"
              >
                <strong>{tr.rescheduling}</strong> {tr.reschedulingNote(reschedule.label)}
              </p>
            )}

            <div className="mt-6">
              <div className="flex gap-5">
                  <Image
                    src="/logo.png"
                    alt={practice.photoAlt}
                    width={120}
                    height={120}
                    preload
                    className="h-24 w-24 shrink-0 rounded-xl border border-line bg-white object-contain p-1.5"
                  />
                  <div className="pt-1">
                    <h1 className="text-[30px] font-bold leading-tight tracking-tight">
                      {practice.name}
                    </h1>
                    <p className="mt-1 text-[16px] font-medium text-ink-soft">
                      {practice.specialty}
                    </p>
                    <p className="mt-0.5 text-[16px] text-ink-soft">{practice.addressLine}</p>
                    <p className="mt-2 text-[15px] font-medium text-teal">{tr.bookSubtitle}</p>
                  </div>
                </div>
            </div>

            <ProviderSlots hours={hours} />

            <div className="mt-12 max-w-3xl">
              <ProfilePanel hours={hours} />
            </div>
          </div>
        </div>
      </BookingProvider>
    </LangProvider>
  );
}
