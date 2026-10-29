"use client";

import Link from "next/link";
import BookLink from "@/components/analytics/BookLink";
import PhoneLink from "@/components/analytics/PhoneLink";
import { useLang } from "@/components/lang-context";
import Ico from "@/components/site/Ico";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import { longDate, monthDay } from "@/lib/i18n";
import { officeById, providerById } from "@/lib/scheduling";
import { site } from "@/lib/site";
import {
  bookHref,
  CompactRow,
  EmptyState,
  NextCard,
  PRIMARY,
  shortName,
  Stat,
  useMyBookings,
  type MyBooking,
} from "./MyBookings";

const CARD = "rounded-[20px] border border-mist bg-white";
const H2 = "text-[1.05rem] font-semibold text-plum";

/**
 * The patient's panel home: what needs doing first (check-ins), the next
 * visit, the ones after it, and their providers, offices and the front desk.
 */
export default function PatientOverview({
  firstName,
  initial,
}: {
  firstName: string;
  initial: MyBooking[];
}) {
  const { lang, tr } = useLang();
  const { bookings, groups, error, cancelProps } = useMyBookings(initial);

  const [next, ...later] = groups.upcoming;
  const lastVisit = groups.completed[0];
  const toCheckIn = groups.upcoming.filter((booking) => !booking.intake?.submittedAt);

  // Providers from all visits, most recent first, once each.
  const seen = [...groups.upcoming, ...groups.completed].filter(
    (booking, index, list) =>
      list.findIndex((item) => item.providerId === booking.providerId) === index,
  );
  const offices = [
    ...new Set([...groups.upcoming, ...groups.completed].map((booking) => booking.officeId)),
  ]
    .map((id) => officeById(id))
    .filter((office) => office !== null);

  return (
    <div lang={lang}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.9rem,4vw,2.5rem)] font-normal leading-tight text-plum">
            {tr.hi(firstName)}
          </h1>
          <p className="mt-1 text-plum-soft">{tr.upcomingSummary(groups.upcoming.length)}</p>
        </div>
        <BookLink href={site.bookCta} className={`${PRIMARY} max-sm:w-full`}>
          <Ico name="cal" className="h-4 w-4" />
          {tr.bookTitle}
        </BookLink>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-wine-soft px-4 py-3 text-[15px] text-wine-deep"
        >
          {error}
        </p>
      )}

      {bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {toCheckIn.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[20px] border border-wine/15 bg-wine-soft/70 px-5 py-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-wine">
                <Ico name="shield" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-wine-deep">{tr.checkInsDue(toCheckIn.length)}</p>
                <p className="text-[14px] text-plum-soft">
                  {toCheckIn
                    .map((booking) => `${longDate(booking.date, lang)} · ${booking.time.toUpperCase()}`)
                    .join("  ·  ")}
                  {" — "}
                  {tr.checkInsDueSub}
                </p>
              </div>
              <Link
                href={`/appointment/${toCheckIn[0].manageToken}/check-in`}
                className={`${PRIMARY} max-sm:w-full`}
              >
                {tr.checkInStart}
                <Ico name="arrow" className="h-4 w-4" />
              </Link>
            </div>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat icon="cal" label={tr.statUpcoming} value={String(groups.upcoming.length)} />
            <Stat icon="shield" label={tr.statCheckIns} value={String(toCheckIn.length)} />
            <Stat icon="check" label={tr.statVisits} value={String(groups.completed.length)} />
            <Stat
              icon="clock"
              label={tr.statLastVisit}
              value={lastVisit ? monthDay(lastVisit.date, lang) : "—"}
            />
          </dl>

          <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-8">
              <section aria-labelledby="next-title">
                <h2 id="next-title" className={`${H2} mb-3`}>
                  {tr.nextAppointment}
                </h2>
                {next ? (
                  <NextCard booking={next} {...cancelProps(next)} />
                ) : (
                  <div className="rounded-[20px] border border-dashed border-mist bg-white px-6 py-10 text-center">
                    <p className="text-plum-soft">{tr.nothingBooked}</p>
                    <BookLink
                      href={lastVisit ? bookHref(lastVisit) : site.bookCta}
                      className={`${PRIMARY} mt-4`}
                    >
                      {lastVisit && providerById(lastVisit.providerId)
                        ? tr.bookWith(shortName(providerById(lastVisit.providerId)!.name))
                        : tr.bookTitle}
                    </BookLink>
                  </div>
                )}
              </section>

              {later.length > 0 && (
                <section aria-labelledby="later-title">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 id="later-title" className={H2}>
                      {tr.alsoComingUp}{" "}
                      <span className="font-normal text-plum-soft">({later.length})</span>
                    </h2>
                    <Link
                      href="/my-bookings/appointments"
                      className="focus-ring text-[14px] font-medium text-wine link-underline"
                    >
                      {tr.seeAll}
                    </Link>
                  </div>
                  <ul className={`${CARD} divide-y divide-mist overflow-hidden`}>
                    {later.slice(0, 3).map((booking) => (
                      <CompactRow key={booking.id} booking={booking} />
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* ----------------------------------------------- side column -- */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <section aria-labelledby="providers-title" className={`${CARD} p-5`}>
                <h2 id="providers-title" className={H2}>
                  {tr.yourProviders}
                </h2>
                {seen.length === 0 ? (
                  <p className="mt-3 text-[14px] text-plum-soft">{tr.noProvidersYet}</p>
                ) : (
                  <ul className="mt-3 divide-y divide-mist">
                    {seen.map((booking) => {
                      const provider = providerById(booking.providerId);
                      if (!provider) return null;
                      return (
                        <li key={booking.id} className="flex items-start gap-3 py-3">
                          <ProviderAvatar provider={provider} size="xs" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-medium leading-snug text-plum">
                              {provider.name}
                            </p>
                            <p className="text-[13px] text-plum-soft">{provider.cred}</p>
                            <BookLink
                              href={bookHref(booking)}
                              aria-label={tr.bookAgainWith(shortName(provider.name))}
                              className="focus-ring mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-wine link-underline"
                            >
                              {tr.bookAgain}
                            </BookLink>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {offices.length > 0 && (
                <section aria-labelledby="offices-title" className={`${CARD} p-5`}>
                  <h2 id="offices-title" className={H2}>
                    {tr.yourOffices}
                  </h2>
                  <ul className="mt-3 space-y-4">
                    {offices.map((office) => (
                      <li key={office.id} className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ivory text-wine">
                          <Ico name="pin" className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-plum">{office.name}</p>
                          <p className="text-[13px] text-plum-soft">{office.address.join(", ")}</p>
                          <a
                            href={office.maps}
                            target="_blank"
                            rel="noreferrer"
                            className="focus-ring text-[13px] font-medium text-wine link-underline"
                          >
                            {tr.directions}
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rounded-[20px] bg-night p-5 text-white sm:col-span-2 xl:col-span-1">
                <p className="font-semibold">{tr.helpTitle}</p>
                <p className="mt-1 text-[14px] text-white/70">{tr.helpSub}</p>
                <PhoneLink
                  href={site.phoneHref}
                  className="focus-ring mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-medium text-plum transition hover:bg-ivory"
                >
                  <Ico name="phone" className="h-4 w-4" />
                  {site.phone}
                </PhoneLink>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
