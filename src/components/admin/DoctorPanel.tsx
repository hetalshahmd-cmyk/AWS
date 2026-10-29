"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, formatShort } from "@/lib/availability";
import { timeToMinutes, type Booking } from "@/lib/models";
import {
  arizonaMinutesNow,
  arizonaTodayIso,
  mondayOf,
  officeById,
  type ProviderId,
} from "@/lib/scheduling";
import BookForPatient from "./BookForPatient";
import { FIELD, Notice } from "./ui";

type Tab = "today" | "upcoming" | "past" | "cancelled";

function started(booking: Booking): boolean {
  const today = arizonaTodayIso();
  if (booking.date !== today) return booking.date < today;
  return timeToMinutes(booking.time) <= arizonaMinutesNow();
}

const key = (booking: Booking) =>
  `${booking.date} ${String(timeToMinutes(booking.time)).padStart(4, "0")}`;

/**
 * A provider's own appointments: today, upcoming, past and cancelled, with
 * check-in status, search, cancel, and booking a patient into their times.
 */
export default function DoctorPanel({
  providerId,
  initial,
}: {
  providerId: ProviderId;
  initial: Booking[];
}) {
  const [bookings, setBookings] = useState(initial);
  const [tab, setTab] = useState<Tab>("today");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const today = arizonaTodayIso();
  const weekEnd = addDays(mondayOf(today), 6);

  const groups = useMemo(() => {
    const confirmed = bookings.filter((booking) => booking.status === "confirmed");
    const upcoming = confirmed
      .filter((booking) => !started(booking))
      .sort((a, b) => key(a).localeCompare(key(b)));
    return {
      today: confirmed
        .filter((booking) => booking.date === today)
        .sort((a, b) => key(a).localeCompare(key(b))),
      upcoming,
      past: confirmed.filter(started).sort((a, b) => key(b).localeCompare(key(a))),
      cancelled: bookings
        .filter((booking) => booking.status === "cancelled")
        .sort((a, b) => key(b).localeCompare(key(a))),
      thisWeek: upcoming.filter((booking) => booking.date <= weekEnd).length,
      checkedIn: upcoming.filter((booking) => booking.intake?.submittedAt).length,
    };
  }, [bookings, today, weekEnd]);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = groups[tab];
    if (!term) return list;
    return list.filter((booking) =>
      `${booking.patient.firstName} ${booking.patient.lastName} ${booking.patient.email} ${booking.reason} ${booking.date}`
        .toLowerCase()
        .includes(term),
    );
  }, [groups, tab, query]);

  // Group the visible rows by day, keeping the tab's order.
  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of rows) map.set(booking.date, [...(map.get(booking.date) ?? []), booking]);
    return [...map.entries()];
  }, [rows]);

  async function cancel(booking: Booking) {
    const name = `${booking.patient.firstName} ${booking.patient.lastName}`;
    if (
      !window.confirm(
        `Cancel ${name}'s appointment on ${formatShort(booking.date)} at ${booking.time}? They'll get a cancellation email.`,
      )
    ) {
      return;
    }
    setBusyId(booking.id);
    setError("");
    setOk("");
    try {
      const response = await fetch(`/api/doctor/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not cancel");
        return;
      }
      setBookings((prev) => prev.map((item) => (item.id === booking.id ? data.booking : item)));
      setOk(`Cancelled ${name}'s appointment.`);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusyId(null);
    }
  }

  const stats = [
    { label: "Today", value: groups.today.length },
    { label: "This week", value: groups.thisWeek },
    { label: "Upcoming", value: groups.upcoming.length },
    { label: "Checked in", value: `${groups.checkedIn}/${groups.upcoming.length}` },
  ];
  const tabs: [Tab, string, number][] = [
    ["today", "Today", groups.today.length],
    ["upcoming", "Upcoming", groups.upcoming.length],
    ["past", "Past", groups.past.length],
    ["cancelled", "Cancelled", groups.cancelled.length],
  ];

  return (
    <div className="mt-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-mist bg-white px-4 py-3.5">
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-plum-soft">
              {stat.label}
            </dt>
            <dd className="mt-1 font-display text-[1.7rem] leading-none text-plum">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Appointments" className="flex flex-wrap gap-1.5">
          {tabs.map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`focus-ring min-h-10 rounded-full px-4 text-[14px] font-semibold transition ${
                tab === value
                  ? "bg-plum text-white"
                  : "border border-line-strong bg-white text-plum hover:bg-shell"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search patient, reason or date"
            aria-label="Search appointments"
            className={`${FIELD} w-64! py-2`}
          />
          <BookForPatient
            providerId={providerId}
            onBooked={(booking, emailed) => {
              setBookings((prev) => [booking, ...prev]);
              setTab(booking.date === today ? "today" : "upcoming");
              setOk(
                `Booked ${booking.patient.firstName} ${booking.patient.lastName} — ${formatShort(booking.date)}, ${booking.time}.` +
                  (emailed
                    ? " Confirmation emailed."
                    : " The confirmation email could not be sent."),
              );
            }}
          />
        </div>
      </div>

      <div aria-live="polite">
        <Notice tone="error">{error}</Notice>
        <Notice tone="ok">{ok}</Notice>
      </div>

      {byDay.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-mist bg-white p-8 text-center text-plum-soft">
          {query
            ? "No appointments match that search."
            : tab === "today"
              ? "No appointments today."
              : "Nothing here."}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {byDay.map(([date, list]) => (
            <section key={date} className="overflow-hidden rounded-2xl border border-mist bg-white">
              <h2 className="flex items-baseline justify-between border-b border-mist bg-shell/60 px-5 py-2.5 font-semibold">
                <span>
                  {formatShort(date)}
                  {date === today && (
                    <span className="ml-2 text-[13px] font-semibold text-wine">Today</span>
                  )}
                </span>
                <span className="text-[13px] font-normal text-plum-soft">
                  {list.length} appointment{list.length === 1 ? "" : "s"}
                </span>
              </h2>
              <ul className="divide-y divide-mist">
                {list.map((booking) => {
                  const done = started(booking);
                  const checkedIn = Boolean(booking.intake?.submittedAt);
                  return (
                    <li
                      key={booking.id}
                      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3.5 sm:flex sm:items-center sm:gap-x-5 sm:px-5"
                    >
                      <p className="shrink-0 font-display text-[1.15rem] text-plum sm:w-20">
                        {booking.time}
                      </p>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {booking.patient.firstName} {booking.patient.lastName}
                          {booking.patientType === "new" && (
                            <span className="ml-2 rounded bg-wine-soft px-1.5 py-0.5 text-[11px] font-bold uppercase text-wine-deep">
                              New
                            </span>
                          )}
                        </p>
                        <p className="text-[13px] text-plum-soft">
                          {booking.reason} · {officeById(booking.officeId)?.name ?? "—"} ·{" "}
                          {booking.insurance
                            ? `${booking.insurance.carrier} · ${booking.insurance.plan}`
                            : "Self-pay"}
                          {booking.lang === "es" && " · Español"}
                        </p>
                      </div>
                      {/* Phones: status and buttons get their own line under the details. */}
                      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:shrink-0">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                            booking.status === "cancelled"
                              ? "bg-wine-soft text-wine-deep"
                              : checkedIn
                                ? "bg-sage-soft text-sage-ink"
                                : "bg-shell text-plum-soft"
                          }`}
                        >
                          {booking.status === "cancelled"
                            ? "Cancelled"
                            : checkedIn
                              ? "✓ Checked in"
                              : "Not checked in"}
                        </span>
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/doctor/bookings/${booking.id}`}
                            className="focus-ring inline-flex min-h-10 items-center rounded-lg border border-line-strong px-3.5 text-[14px] font-semibold transition hover:bg-shell"
                          >
                            View
                          </Link>
                          {booking.status === "confirmed" && !done && (
                            <button
                              type="button"
                              disabled={busyId === booking.id}
                              onClick={() => cancel(booking)}
                              className="focus-ring inline-flex min-h-10 items-center rounded-lg px-3 text-[14px] font-semibold text-wine transition hover:bg-wine-soft disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
