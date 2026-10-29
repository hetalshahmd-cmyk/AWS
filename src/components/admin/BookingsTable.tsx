"use client";

import { getAllProviders } from "@/lib/providers";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Booking } from "@/lib/models";
import { formatShort } from "@/lib/availability";
import { getOffices } from "@/lib/site-content";
import { officeById, shortProviderName } from "@/lib/scheduling";
import BookForPatient from "./BookForPatient";
import { FIELD, Notice, StatusBadge } from "./ui";

type Filter = "all" | "confirmed" | "cancelled" | "upcoming";

export default function BookingsTable({ initial }: { initial: Booking[] }) {
  const [bookings, setBookings] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("all");
  const [provider, setProvider] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const todayIso = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (filter === "confirmed" && booking.status !== "confirmed") return false;
      if (filter === "cancelled" && booking.status !== "cancelled") return false;
      if (filter === "upcoming" && (booking.status !== "confirmed" || booking.date < todayIso)) {
        return false;
      }
      if (office !== "all" && booking.officeId !== office) return false;
      if (provider !== "all" && booking.providerId !== provider) return false;
      if (!term) return true;
      const haystack =
        `${booking.patient.firstName} ${booking.patient.lastName} ${booking.patient.email} ${booking.reason} ${booking.date} ${shortProviderName(booking.providerId)} ${officeById(booking.officeId)?.area ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [bookings, filter, query, todayIso, office, provider]);

  async function patchStatus(id: string, status: "confirmed" | "cancelled") {
    if (
      status === "cancelled" &&
      !window.confirm("Cancel this appointment? The time opens up for others.")
    ) {
      return;
    }
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not update the booking");
        return;
      }
      setBookings((prev) => prev.map((item) => (item.id === id ? data.booking : item)));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (
      !window.confirm(
        "Delete this booking for good? Its check-in answers and photos are deleted too. This can't be undone.",
      )
    ) {
      return;
    }
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Could not delete the booking");
        return;
      }
      setBookings((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "upcoming", "confirmed", "cancelled"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`focus-ring rounded-full px-3.5 py-1.5 text-[14px] font-semibold capitalize transition ${
                filter === option
                  ? "bg-wine text-white"
                  : "border border-line-strong bg-white hover:bg-shell"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, reason or date"
          className={`${FIELD} sm:max-w-xs`}
        />
        <select
          aria-label="Office"
          value={office}
          onChange={(event) => setOffice(event.target.value)}
          className={`${FIELD} w-auto!`}
        >
          <option value="all">Both offices</option>
          {getOffices().map((item) => (
            <option key={item.id} value={item.id}>
              {item.area}
            </option>
          ))}
        </select>
        <select
          aria-label="Provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          className={`${FIELD} w-auto!`}
        >
          <option value="all">All providers</option>
          {getAllProviders().map((item) => (
            <option key={item.id} value={item.id}>
              {shortProviderName(item.id)}
            </option>
          ))}
        </select>
        <span className="text-[14px] text-plum-soft">
          {rows.length} of {bookings.length}
        </span>
        <div className="ml-auto">
          <BookForPatient
            onBooked={(booking, emailed) => {
              setBookings((prev) => [booking, ...prev]);
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

      <Notice tone="error">{error}</Notice>
      <Notice tone="ok">{ok}</Notice>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-mist bg-white">
        <table className="w-full min-w-[920px] border-collapse text-left text-[14px]">
          <thead className="border-b border-mist bg-shell/70 text-[11px] uppercase tracking-wide text-plum-soft">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Patient</th>
              <th className="px-4 py-2.5 font-semibold">Appointment</th>
              <th className="px-4 py-2.5 font-semibold">Visit</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {rows.map((booking) => {
              const checkedIn = Boolean(booking.intake?.submittedAt);
              const emails = [
                booking.confirmationSentAt ? "Confirmation sent" : "No confirmation sent",
                booking.reminders?.threeDay && "3-day reminder sent",
                booking.reminders?.oneDay && "1-day reminder sent",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <tr key={booking.id} className="align-top transition hover:bg-shell/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {booking.patient.firstName} {booking.patient.lastName}
                      {booking.patientType === "new" && (
                        <span className="ml-1.5 rounded bg-wine-soft px-1 py-0.5 align-middle text-[10px] font-bold uppercase text-wine-deep">
                          New
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-plum-soft">{booking.patient.email}</p>
                    <p className="text-[12px] text-plum-soft">DOB {booking.patient.dob}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-medium">
                      {formatShort(booking.date)} · {booking.time}
                    </p>
                    <p className="text-[12px] text-plum-soft">
                      {booking.providerId ? shortProviderName(booking.providerId) : "—"} ·{" "}
                      {officeById(booking.officeId)?.area ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{booking.reason}</p>
                    <p className="text-[12px] text-plum-soft">
                      {booking.insurance
                        ? `${booking.insurance.carrier} · ${booking.insurance.plan}`
                        : "Self-pay"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={booking.status} />
                    <div
                      className="mt-1.5 flex flex-wrap gap-1 text-[11px] font-semibold"
                      title={emails}
                    >
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          checkedIn ? "bg-sage-soft text-sage-ink" : "bg-shell text-plum-soft"
                        }`}
                      >
                        {checkedIn ? "✓ Check-in" : "No check-in"}
                      </span>
                      {booking.via === "guest" && (
                        <span className="rounded bg-shell px-1.5 py-0.5 text-plum-soft">Guest</span>
                      )}
                      {booking.via === "staff" && (
                        <span className="rounded bg-shell px-1.5 py-0.5 text-plum-soft">
                          By staff
                        </span>
                      )}
                      {booking.lang === "es" && (
                        <span className="rounded bg-shell px-1.5 py-0.5 text-plum-soft">ES</span>
                      )}
                      {!booking.confirmationSentAt && (
                        <span className="rounded bg-wine-soft px-1.5 py-0.5 text-wine-deep">
                          No email
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/admin/bookings/${booking.id}`}
                        className="focus-ring inline-flex min-h-9 items-center rounded-lg border border-line-strong px-3 text-[13px] font-semibold transition hover:bg-shell"
                      >
                        View
                      </Link>
                      {booking.status === "confirmed" ? (
                        <button
                          type="button"
                          disabled={busyId === booking.id}
                          onClick={() => patchStatus(booking.id, "cancelled")}
                          className="focus-ring inline-flex min-h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold text-wine transition hover:bg-wine-soft disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === booking.id}
                          onClick={() => patchStatus(booking.id, "confirmed")}
                          className="focus-ring inline-flex min-h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold text-plum transition hover:bg-shell disabled:opacity-60"
                        >
                          Restore
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === booking.id}
                        onClick={() => remove(booking.id)}
                        aria-label={`Delete booking for ${booking.patient.firstName} ${booking.patient.lastName}`}
                        className="focus-ring inline-flex min-h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold text-plum-soft transition hover:bg-shell hover:text-wine disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-plum-soft">
                  No bookings match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
