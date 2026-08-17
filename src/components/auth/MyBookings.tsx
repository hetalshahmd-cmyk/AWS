"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Booking } from "@/lib/models";
import { formatLong } from "@/lib/availability";
import { practice } from "@/lib/practice";
import { useSession } from "./session-context";

export default function MyBookings() {
  const { user, loading } = useSession();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=%2Fmy-bookings");
      return;
    }

    let cancelled = false;
    fetch("/api/my/bookings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { bookings?: Booking[]; error?: string }) => {
        if (cancelled) return;
        if (data.bookings) setBookings(data.bookings);
        else setError(data.error ?? "Could not load your bookings");
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach the server");
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  async function cancel(id: string) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/my/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not cancel the booking");
        return;
      }
      setBookings((prev) =>
        prev ? prev.map((booking) => (booking.id === id ? data.booking : booking)) : prev,
      );
      setConfirmId(null);
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user) {
    return <p className="text-plum-soft">Loading…</p>;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = (bookings ?? []).filter(
    (booking) => booking.status === "confirmed" && booking.date >= todayIso,
  );
  const past = (bookings ?? []).filter(
    (booking) => booking.status !== "confirmed" || booking.date < todayIso,
  );

  return (
    <div>
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] font-semibold leading-tight">
        My bookings
      </h1>
      <p className="mt-2 text-plum-soft">
        Signed in as {user.email}. Cancelling frees the time for someone else — to move an
        appointment, cancel and book again, or call {practice.phone}.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-wine-soft px-3 py-2 text-[15px] text-wine-deep">
          {error}
        </p>
      )}

      {bookings === null ? (
        <p className="mt-6 text-plum-soft">Loading your appointments…</p>
      ) : bookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-mist bg-shell p-8 text-center">
          <p className="text-plum-soft">You don&apos;t have any appointments yet.</p>
          <Link
            href="/book"
            className="focus-ring mt-4 inline-flex rounded-full bg-wine px-6 py-3 text-[16px] font-semibold text-white transition hover:bg-wine-deep"
          >
            Book an appointment
          </Link>
        </div>
      ) : (
        <>
          <Section title="Upcoming" count={upcoming.length}>
            {upcoming.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                busy={busyId === booking.id}
                confirming={confirmId === booking.id}
                onAskCancel={() => setConfirmId(booking.id)}
                onDismiss={() => setConfirmId(null)}
                onCancel={() => cancel(booking.id)}
              />
            ))}
            {upcoming.length === 0 && (
              <p className="rounded-2xl border border-mist bg-shell px-5 py-6 text-plum-soft">
                Nothing coming up.{" "}
                <Link href="/book" className="font-semibold text-wine link-underline">
                  Book an appointment
                </Link>
                .
              </p>
            )}
          </Section>

          {past.length > 0 && (
            <Section title="Past & cancelled" count={past.length}>
              {past.map((booking) => (
                <BookingRow key={booking.id} booking={booking} past />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-[1.3rem] font-semibold">
        {title} <span className="text-plum-soft">({count})</span>
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function BookingRow({
  booking,
  past = false,
  busy = false,
  confirming = false,
  onAskCancel,
  onDismiss,
  onCancel,
}: {
  booking: Booking;
  past?: boolean;
  busy?: boolean;
  confirming?: boolean;
  onAskCancel?: () => void;
  onDismiss?: () => void;
  onCancel?: () => void;
}) {
  const cancelled = booking.status === "cancelled";

  return (
    <article
      className={`rounded-2xl border p-5 ${
        cancelled ? "border-mist bg-shell" : "border-mist bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-[1.15rem] font-semibold">
            {formatLong(booking.date)} at {booking.time.toUpperCase()} {practice.timezone}
          </p>
          <p className="mt-0.5 text-[15px] text-plum-soft">{booking.reason}</p>
          <p className="mt-1 text-[14px] text-plum-soft">
            {practice.addressFull} ·{" "}
            {booking.insurance
              ? `${booking.insurance.carrier} · ${booking.insurance.plan}`
              : "Self-pay"}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
            cancelled ? "bg-wine-soft text-wine-deep" : "bg-sage-soft text-sage-ink"
          }`}
        >
          {cancelled ? "Cancelled" : past ? "Completed" : "Confirmed"}
        </span>
      </div>

      {!past && !cancelled && (
        <div className="mt-4 border-t border-mist pt-4">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[15px] font-semibold">Cancel this appointment?</p>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="focus-ring rounded-full bg-wine px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-wine-deep disabled:opacity-60"
              >
                {busy ? "Cancelling…" : "Yes, cancel it"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDismiss}
                className="focus-ring rounded-full border border-mist px-4 py-2 text-[14px] font-semibold transition hover:bg-shell"
              >
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onAskCancel}
              className="focus-ring rounded-full border-[1.5px] border-wine px-4 py-2 text-[14px] font-semibold text-wine transition hover:bg-wine hover:text-white"
            >
              Cancel appointment
            </button>
          )}
        </div>
      )}
    </article>
  );
}
