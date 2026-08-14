"use client";

import { useMemo, useState } from "react";
import type { Booking } from "@/lib/models";
import { formatShort } from "@/lib/availability";
import { BTN_DANGER, BTN_QUIET, FIELD, Notice, StatusBadge } from "./ui";

type Filter = "all" | "confirmed" | "cancelled" | "upcoming";

export default function BookingsTable({ initial }: { initial: Booking[] }) {
  const [bookings, setBookings] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const todayIso = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (filter === "confirmed" && booking.status !== "confirmed") return false;
      if (filter === "cancelled" && booking.status !== "cancelled") return false;
      if (filter === "upcoming" && (booking.status !== "confirmed" || booking.date < todayIso)) {
        return false;
      }
      if (!term) return true;
      const haystack =
        `${booking.patient.firstName} ${booking.patient.lastName} ${booking.patient.email} ${booking.reason} ${booking.date}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [bookings, filter, query, todayIso]);

  async function patchStatus(id: string, status: "confirmed" | "cancelled") {
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
        <span className="text-[14px] text-plum-soft">
          {rows.length} of {bookings.length}
        </span>
      </div>

      <Notice tone="error">{error}</Notice>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-mist bg-white">
        <table className="w-full min-w-[820px] border-collapse text-left text-[14px]">
          <thead className="bg-shell text-[13px] uppercase tracking-wide text-plum-soft">
            <tr>
              <th className="px-4 py-3 font-semibold">Patient</th>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Insurance</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {rows.map((booking) => (
              <tr key={booking.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold">
                    {booking.patient.firstName} {booking.patient.lastName}
                  </p>
                  <p className="text-[13px] text-plum-soft">{booking.patient.email}</p>
                  <p className="text-[12px] text-plum-soft">
                    DOB {booking.patient.dob} · {booking.patient.sex} ·{" "}
                    {booking.patientType === "new" ? "New patient" : "Existing patient"}
                  </p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatShort(booking.date)}
                  <br />
                  <span className="text-plum-soft">{booking.time.toUpperCase()}</span>
                </td>
                <td className="px-4 py-3">{booking.reason}</td>
                <td className="px-4 py-3">
                  {booking.insurance
                    ? `${booking.insurance.carrier} · ${booking.insurance.plan}`
                    : "Self-pay"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {booking.status === "confirmed" ? (
                      <button
                        type="button"
                        disabled={busyId === booking.id}
                        onClick={() => patchStatus(booking.id, "cancelled")}
                        className={BTN_DANGER}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === booking.id}
                        onClick={() => patchStatus(booking.id, "confirmed")}
                        className={BTN_QUIET}
                      >
                        Restore
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === booking.id}
                      onClick={() => remove(booking.id)}
                      className={BTN_QUIET}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-plum-soft">
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
