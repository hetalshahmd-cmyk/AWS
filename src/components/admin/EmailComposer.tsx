"use client";

import { useEffect, useState } from "react";
import {
  fillTemplate,
  fromTimeField,
  MAX_EMAIL,
  MAX_SUBJECT,
  TEMPLATE_LABELS,
  toTimeField,
  type BookingForEmail,
  type EmailTemplate,
  type PatientEmail,
} from "@/lib/patient-email";
import { site } from "@/lib/site";
import { BTN_PRIMARY, BTN_QUIET, CARD, FIELD, LABEL, Notice } from "./ui";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Write to the patient on one booking: pick a template (it fills in their
 * name, provider, office and time — and the new time when it moved), change
 * anything, send. Earlier emails for the booking are listed under it.
 */
export function EmailComposer({ booking, onSent }: { booking: BookingForEmail; onSent?: (email: PatientEmail) => void }) {
  const [template, setTemplate] = useState<EmailTemplate>("time-changed");
  const [moved, setMoved] = useState({ date: booking.date, time: toTimeField(booking.time) });
  const [draft, setDraft] = useState(() =>
    fillTemplate("time-changed", booking, site, { date: booking.date, time: booking.time }),
  );
  const [history, setHistory] = useState<PatientEmail[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/emails?booking=${booking.id}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setHistory(data.emails ?? []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [booking.id]);

  function refill(next: EmailTemplate, nextMoved = moved) {
    setTemplate(next);
    setDraft(fillTemplate(next, booking, site, { date: nextMoved.date, time: fromTimeField(nextMoved.time) ?? booking.time }));
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const response = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, template, ...draft }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.email) setHistory((list) => [data.email, ...(list ?? [])]);
      if (!response.ok) {
        setError(data.error ?? "Could not send the email");
        return;
      }
      setOk(`Sent to ${booking.email}`);
      onSent?.(data.email);
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-4">
      <p className="text-[14px] text-plum-soft">
        To <strong className="text-plum">{booking.firstName} {booking.lastName}</strong> · {booking.email}
        {booking.lang === "es" && " · writes in Spanish"}
      </p>
      <label className="block">
        <span className={LABEL}>Template</span>
        <select value={template} onChange={(event) => refill(event.target.value as EmailTemplate)} className={FIELD}>
          {(Object.keys(TEMPLATE_LABELS) as EmailTemplate[]).map((key) => (
            <option key={key} value={key}>
              {TEMPLATE_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
      {template === "time-changed" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>New date</span>
            <input
              type="date"
              required
              value={moved.date}
              onChange={(event) => {
                const next = { ...moved, date: event.target.value };
                setMoved(next);
                refill(template, next);
              }}
              className={FIELD}
            />
          </label>
          <label className="block">
            <span className={LABEL}>New time</span>
            <input
              type="time"
              required
              value={moved.time}
              onChange={(event) => {
                const next = { ...moved, time: event.target.value };
                setMoved(next);
                refill(template, next);
              }}
              className={FIELD}
            />
          </label>
          <p className="text-[12px] text-plum-soft sm:col-span-2">
            This only writes the email. Move the booking itself in Appointment slots if it isn&apos;t moved yet.
          </p>
        </div>
      )}
      <label className="block">
        <span className={LABEL}>Subject</span>
        <input required maxLength={MAX_SUBJECT} value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} className={FIELD} />
      </label>
      <label className="block">
        <span className={LABEL}>Message</span>
        <textarea required rows={10} maxLength={MAX_EMAIL} value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} className={FIELD} />
      </label>
      <p className="text-[12px] text-plum-soft">
        Goes from the practice&apos;s email address, with our name and phone number at the bottom. Keep medical details
        out of email — ask them to call instead.
      </p>
      <button type="submit" className={BTN_PRIMARY} disabled={busy || draft.subject.trim().length < 3 || draft.message.trim().length < 5}>
        {busy ? "Sending…" : "Send email"}
      </button>
      <Notice tone="error">{error}</Notice>
      <Notice tone="ok">{ok}</Notice>

      <div className="border-t border-mist pt-4">
        <p className="text-[13px] font-semibold text-plum">Emails sent for this booking</p>
        {history === null ? (
          <p className="mt-1 text-[13px] text-plum-soft">Loading…</p>
        ) : history.length === 0 ? (
          <p className="mt-1 text-[13px] text-plum-soft">None yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {history.map((item) => (
              <li key={item.id}>
                <span className={item.status === "sent" ? "text-sage-ink" : "text-wine-deep"}>{item.status === "sent" ? "✓" : "✗ Not sent"}</span>{" "}
                <strong>{item.subject}</strong> <span className="text-plum-soft">· {when(item.sentAt)} · {item.sentBy}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}

/** "Email patient" on a booking: opens the composer in a panel. */
export default function EmailPatientButton({ booking }: { booking: BookingForEmail }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={BTN_QUIET} onClick={() => setOpen(true)}>
        ✉ Email patient
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Email the patient"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-plum/50 p-0 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className={`${CARD} max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none sm:rounded-2xl`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[1.2rem] font-semibold">Email the patient</h2>
              <button type="button" onClick={() => setOpen(false)} className={BTN_QUIET}>
                Close
              </button>
            </div>
            <EmailComposer booking={booking} />
          </div>
        </div>
      )}
    </>
  );
}
