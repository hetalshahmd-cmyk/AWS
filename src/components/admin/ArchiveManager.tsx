"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatShort } from "@/lib/availability";
import { shortDate } from "@/lib/format";
import type { Booking } from "@/lib/models";
import type { ArchivedPatient } from "@/lib/repo";
import { shortProviderName } from "@/lib/scheduling";
import { BTN_DANGER, BTN_QUIET, Notice, StatusBadge } from "./ui";

type Kind = "bookings" | "patients";
type Action = "restore" | "delete";

/**
 * Admin → Archive. Deleted bookings and patients wait here: tick some, then
 * restore them or delete them for good (after a confirmation). The dashboard
 * keeps counting them either way.
 */
export default function ArchiveManager({ bookings: initialBookings, patients: initialPatients }: { bookings: Booking[]; patients: ArchivedPatient[] }) {
  const [kind, setKind] = useState<Kind>("bookings");
  const [bookings, setBookings] = useState(initialBookings);
  const [patients, setPatients] = useState(initialPatients);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const rows = kind === "bookings" ? bookings : patients;
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const count = selected.size;
  const noun = kind === "bookings" ? (count === 1 ? "booking" : "bookings") : count === 1 ? "patient" : "patients";

  const switchTo = (next: Kind) => {
    setKind(next);
    setSelected(new Set());
    setConfirming(false);
    setError("");
    setOk("");
  };
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    if (!confirming) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setConfirming(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming, busy]);

  async function run(action: Action) {
    const chosen = [...selected];
    if (!chosen.length) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch("/api/admin/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, action, ids: chosen }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "That didn't work — please try again");
        return;
      }
      // Reload both tabs: restoring a patient brings their bookings back too.
      const fresh = await fetch("/api/admin/archive").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (fresh) {
        setBookings(fresh.bookings);
        setPatients(fresh.patients);
      }
      setSelected(new Set());
      setConfirming(false);
      const n = data.count ?? 0;
      const what = kind === "bookings" ? (n === 1 ? "booking" : "bookings") : n === 1 ? "patient" : "patients";
      if (action === "delete") {
        setOk(`Deleted ${n} ${what} permanently. The dashboard's booking counts are unchanged.`);
      } else {
        const left = kind === "bookings" ? (data.skipped?.length ?? 0) : (data.skippedBookings ?? 0);
        setOk(
          `Restored ${n} ${what}.` +
            (left
              ? ` ${left} booking${left === 1 ? "" : "s"} stayed in the Archive — that time has been booked by someone else.`
              : ""),
        );
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Archive" className="flex gap-1.5">
          {(["bookings", "patients"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={kind === option}
              onClick={() => switchTo(option)}
              className={`focus-ring rounded-full px-4 py-2 text-[14px] font-semibold capitalize transition ${
                kind === option ? "bg-wine text-white" : "border border-line-strong bg-white hover:bg-shell"
              }`}
            >
              {option} <span className="opacity-75">({option === "bookings" ? bookings.length : patients.length})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN_QUIET} disabled={!count || busy} onClick={() => void run("restore")}>
            Restore{count ? ` (${count})` : ""}
          </button>
          <button type="button" className={BTN_DANGER} disabled={!count || busy} onClick={() => setConfirming(true)}>
            Delete permanently{count ? ` (${count})` : ""}
          </button>
        </div>
      </div>

      {!confirming && (
        <>
          <Notice tone="error">{error}</Notice>
          <Notice tone="ok">{ok}</Notice>
        </>
      )}

      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-mist bg-white p-6 text-plum-soft">
          {kind === "bookings" ? "No archived bookings." : "No archived patients."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-mist bg-white">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="border-b border-mist bg-shell text-[12px] font-semibold uppercase tracking-wide text-plum-soft">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select all ${kind}`}
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(ids))}
                    className="h-4 w-4 accent-[#7c2c3e]"
                  />
                </th>
                {kind === "bookings" ? (
                  <>
                    <th className="px-3 py-3">Patient</th>
                    <th className="px-3 py-3">Appointment</th>
                    <th className="px-3 py-3">Provider</th>
                    <th className="px-3 py-3">Status</th>
                  </>
                ) : (
                  <>
                    <th className="px-3 py-3">Patient</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Bookings</th>
                  </>
                )}
                <th className="px-3 py-3">Archived</th>
                <th className="px-3 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {kind === "bookings"
                ? bookings.map((booking) => (
                    <tr key={booking.id} className={selected.has(booking.id) ? "bg-wine-soft/40" : undefined}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${booking.patient.firstName} ${booking.patient.lastName}`}
                          checked={selected.has(booking.id)}
                          onChange={() => toggle(booking.id)}
                          className="h-4 w-4 accent-[#7c2c3e]"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-plum">
                        {booking.patient.firstName} {booking.patient.lastName}
                        <span className="block text-[13px] font-normal text-plum-soft">{booking.patient.email}</span>
                      </td>
                      <td className="px-3 py-3">
                        {formatShort(booking.date)} · {booking.time}
                      </td>
                      <td className="px-3 py-3">{booking.providerId ? shortProviderName(booking.providerId) : "—"}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="px-3 py-3 text-plum-soft">
                        {shortDate(booking.archivedAt ?? "")}
                        {booking.archivedBy ? <span className="block text-[12px]">by {booking.archivedBy}</span> : null}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={`/admin/bookings/${booking.id}`} className="focus-ring font-semibold text-wine link-underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                : patients.map((patient) => (
                    <tr key={patient.id} className={selected.has(patient.id) ? "bg-wine-soft/40" : undefined}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${patient.name}`}
                          checked={selected.has(patient.id)}
                          onChange={() => toggle(patient.id)}
                          className="h-4 w-4 accent-[#7c2c3e]"
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-plum">{patient.name}</td>
                      <td className="px-3 py-3 text-plum-soft">{patient.email}</td>
                      <td className="px-3 py-3 tabular-nums">{patient.bookings}</td>
                      <td className="px-3 py-3 text-plum-soft">
                        {shortDate(patient.archivedAt)}
                        {patient.archivedBy ? <span className="block text-[12px]">by {patient.archivedBy}</span> : null}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={`/admin/users/${patient.id}`} className="focus-ring font-semibold text-wine link-underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-plum/50 p-0 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setConfirming(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="purge-title"
            aria-describedby="purge-body"
            className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl"
          >
            <h2 id="purge-title" className="font-display text-[1.4rem] font-semibold text-plum">
              Delete {count} {noun} permanently?
            </h2>
            <div id="purge-body" className="mt-3 space-y-2 text-[15px] text-plum-soft">
              <p>
                {kind === "bookings"
                  ? "The patient's details, check-in answers and photos, and emails sent about these bookings are erased."
                  : "Their account, every booking's patient details, check-in photos, emails and chats are erased."}
              </p>
              <p className="font-semibold text-plum">The dashboard&apos;s booking counts stay the same.</p>
              <p>This can&apos;t be undone.</p>
            </div>
            <Notice tone="error">{error}</Notice>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className={BTN_QUIET} disabled={busy} onClick={() => setConfirming(false)} autoFocus>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("delete")}
                className="focus-ring inline-flex items-center justify-center rounded-lg bg-wine px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-wine-deep disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

