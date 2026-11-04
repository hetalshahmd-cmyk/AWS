"use client";

import Link from "next/link";
import { useState } from "react";
import type { BookingForEmail, PatientEmail } from "@/lib/patient-email";
import { EmailComposer } from "./EmailComposer";
import { usePanel } from "./panel-context";
import { CARD, FIELD, LABEL } from "./ui";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Admin → Email: write to a patient about an upcoming booking, and every email sent. */
export default function EmailCenter({ bookings, initial }: { bookings: BookingForEmail[]; initial: PatientEmail[] }) {
  const panel = usePanel();
  const [chosen, setChosen] = useState("");
  const [sent, setSent] = useState(initial);
  const booking = bookings.find((item) => item.id === chosen) ?? null;

  return (
    <div className="mt-6 grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className={CARD} aria-labelledby="write-email">
        <h2 id="write-email" className="text-[1.1rem] font-semibold">Write to a patient</h2>
        <p className="mt-1 text-[14px] text-plum-soft">
          Pick an upcoming booking — or open any booking and press <strong>Email patient</strong>.
        </p>
        <label className="mt-4 block">
          <span className={LABEL}>Booking</span>
          <select value={chosen} onChange={(event) => setChosen(event.target.value)} className={FIELD}>
            <option value="">Choose a booking…</option>
            {bookings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.date} {item.time} · {item.firstName} {item.lastName} · {item.providerName}
              </option>
            ))}
          </select>
        </label>
        {booking && (
          <div className="mt-5">
            <EmailComposer key={booking.id} booking={booking} onSent={(email) => setSent((list) => [email, ...list])} />
          </div>
        )}
      </section>

      <section className={`${CARD} p-0`} aria-labelledby="sent-emails">
        <h2 id="sent-emails" className="px-6 pt-5 text-[1.1rem] font-semibold">Sent emails</h2>
        {sent.length === 0 ? (
          <p className="px-6 py-5 text-[14px] text-plum-soft">None yet.</p>
        ) : (
          <ul className="mt-3 max-h-[720px] divide-y divide-mist overflow-y-auto">
            {sent.map((email) => (
              <li key={email.id} className="px-6 py-3 text-[14px]">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-plum">{email.subject}</strong>
                  <span className={`text-[12px] font-semibold ${email.status === "sent" ? "text-sage-ink" : "text-wine-deep"}`}>
                    {email.status === "sent" ? "Sent" : "Not sent"}
                  </span>
                </p>
                <p className="text-[13px] text-plum-soft">
                  To {email.patientName} ({email.to}) · {when(email.sentAt)} · by {email.sentBy}
                  {email.bookingId && (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={`${panel.base}/bookings/${email.bookingId}`} className="font-semibold text-wine underline">
                        booking
                      </Link>
                    </>
                  )}
                </p>
                <details className="mt-1">
                  <summary className="cursor-pointer text-[13px] text-plum-soft">Show the message</summary>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-shell px-3 py-2 text-[13px] text-plum">{email.message}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
