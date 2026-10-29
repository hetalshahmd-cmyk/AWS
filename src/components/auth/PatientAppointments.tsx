"use client";

import { useState } from "react";
import BookLink from "@/components/analytics/BookLink";
import { useLang } from "@/components/lang-context";
import Ico from "@/components/site/Ico";
import { site } from "@/lib/site";
import { HistoryRow, PRIMARY, UpcomingRow, useMyBookings, type MyBooking } from "./MyBookings";

type Tab = "upcoming" | "past" | "cancelled";

/** Every appointment the patient has, in three tabs. */
export default function PatientAppointments({ initial }: { initial: MyBooking[] }) {
  const { lang, tr } = useLang();
  const { groups, error, cancelProps } = useMyBookings(initial);
  const [tab, setTab] = useState<Tab>("upcoming");

  const tabs: [Tab, string, number][] = [
    ["upcoming", tr.tabUpcoming, groups.upcoming.length],
    ["past", tr.tabPast, groups.completed.length],
    ["cancelled", tr.tabCancelled, groups.cancelled.length],
  ];
  const empty = { upcoming: tr.noneUpcoming, past: tr.nonePast, cancelled: tr.noneCancelled }[tab];
  const list =
    tab === "upcoming" ? groups.upcoming : tab === "past" ? groups.completed : groups.cancelled;

  return (
    <div lang={lang}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.9rem,4vw,2.5rem)] font-normal leading-tight text-plum">
            {tr.panelAppointments}
          </h1>
          <p className="mt-1 text-plum-soft">{tr.upcomingSummary(groups.upcoming.length)}</p>
        </div>
        <BookLink href={site.bookCta} className={`${PRIMARY} max-sm:w-full`}>
          <Ico name="cal" className="h-4 w-4" />
          {tr.bookTitle}
        </BookLink>
      </div>

      <div
        role="tablist"
        aria-label={tr.panelAppointments}
        className="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-mist bg-white p-1"
      >
        {tabs.map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition ${
              tab === value ? "bg-plum text-white" : "text-plum-soft hover:bg-ivory hover:text-plum"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-1.5 text-[12px] tabular-nums ${
                tab === value ? "bg-white/20" : "bg-ivory"
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-wine-soft px-4 py-3 text-[15px] text-wine-deep"
        >
          {error}
        </p>
      )}

      <div role="tabpanel" className="mt-5">
        {list.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-mist bg-white px-6 py-12 text-center text-plum-soft">
            {empty}
          </p>
        ) : tab === "upcoming" ? (
          <div className="space-y-3">
            {list.map((booking) => (
              <UpcomingRow key={booking.id} booking={booking} {...cancelProps(booking)} />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-mist overflow-hidden rounded-[20px] border border-mist bg-white">
            {list.map((booking) => (
              <HistoryRow key={booking.id} booking={booking} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
