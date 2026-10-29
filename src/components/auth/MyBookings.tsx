"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BookLink from "@/components/analytics/BookLink";
import { useLang } from "@/components/lang-context";
import Ico, { type IcoName } from "@/components/site/Ico";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import { timeToMinutes, type Booking } from "@/lib/models";
import { bookingAddress, downloadCalendarFile } from "@/lib/calendar";
import { dateBadge, longDate, reasonLabel } from "@/lib/i18n";
import { practice } from "@/lib/practice";
import { arizonaMinutesNow, arizonaTodayIso, officeById, providerById } from "@/lib/scheduling";
import { site } from "@/lib/site";

/** A booking as /api/my/bookings returns it: with its signed manage link. */
export type MyBooking = Booking & { manageToken: string };

/* ------------------------------------------------------------- helpers -- */

/** Has this appointment's start time arrived, in Arizona time? */
export function hasStarted(booking: Booking): boolean {
  const today = arizonaTodayIso();
  if (booking.date !== today) return booking.date < today;
  return timeToMinutes(booking.time) <= arizonaMinutesNow();
}

export function sortKey(booking: Booking): string {
  return `${booking.date} ${String(timeToMinutes(booking.time)).padStart(4, "0")}`;
}

export function daysUntil(dateIso: string): number {
  return Math.round(
    (Date.parse(`${dateIso}T00:00:00Z`) - Date.parse(`${arizonaTodayIso()}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * "Book again": that provider's booking form on the Providers page, at the
 * same office. "Reschedule": /book, which carries the visit being moved.
 */
export function bookHref(booking: MyBooking, reschedule = false): string {
  if (!reschedule) {
    if (!booking.providerId) return site.bookCta;
    return `/about#book-${booking.providerId}${booking.officeId ? `-${booking.officeId}` : ""}`;
  }
  const params = new URLSearchParams();
  if (booking.providerId) params.set("provider", booking.providerId);
  if (booking.officeId) params.set("office", booking.officeId);
  params.set("reschedule", booking.manageToken);
  return `${site.bookingUrl}?${params}`;
}

/** "miércoles, 7 oct" → "Miércoles, 7 oct" — only the first letter. */
function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function shortName(name: string): string {
  return name.split(",")[0];
}

/* ---------------------------------------------------------------- hook -- */

/**
 * The patient's bookings for their panel: grouped into upcoming, completed and
 * cancelled, with cancelling built in. Each page of the panel uses this with
 * the list the server already loaded.
 */
export function useMyBookings(initial: MyBooking[]) {
  const { tr } = useLang();
  const [bookings, setBookings] = useState(initial);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

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
        setError(data.error ?? tr.cancelError);
        return;
      }
      setBookings((prev) =>
        prev.map((booking) =>
          booking.id === id ? { ...data.booking, manageToken: booking.manageToken } : booking,
        ),
      );
      setConfirmId(null);
    } catch {
      setError(tr.serverDown);
    } finally {
      setBusyId(null);
    }
  }

  const groups = useMemo(() => {
    const upcoming = bookings
      .filter((booking) => booking.status === "confirmed" && !hasStarted(booking))
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const completed = bookings
      .filter((booking) => booking.status === "confirmed" && hasStarted(booking))
      .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
    const cancelled = bookings
      .filter((booking) => booking.status === "cancelled")
      .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
    return { upcoming, completed, cancelled };
  }, [bookings]);

  const cancelProps = (booking: Booking): CancelControls => ({
    busy: busyId === booking.id,
    confirming: confirmId === booking.id,
    onAskCancel: () => setConfirmId(booking.id),
    onDismiss: () => setConfirmId(null),
    onCancel: () => cancel(booking.id),
  });

  return { bookings, groups, error, cancelProps };
}

/* --------------------------------------------------------------- parts -- */

export function useCountdown() {
  const { tr } = useLang();
  return (dateIso: string) => {
    const days = daysUntil(dateIso);
    if (days <= 0) return tr.today;
    if (days === 1) return tr.tomorrow;
    return tr.inDays(days);
  };
}

export function Stat({ label, value, icon }: { label: string; value: string; icon: IcoName }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-mist bg-white px-4 py-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-wine-soft text-wine">
        <Ico name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <dt className="text-[13px] leading-snug text-plum-soft">{label}</dt>
        <dd className="whitespace-nowrap text-[1.35rem] font-semibold leading-tight text-plum tabular-nums">
          {value}
        </dd>
      </div>
    </div>
  );
}

/** A small calendar leaf: month over day over weekday. */
export function DateBadge({ date, muted = false }: { date: string; muted?: boolean }) {
  const { lang } = useLang();
  const { month, day, weekday } = dateBadge(date, lang);
  return (
    <span
      aria-hidden="true"
      className={`flex w-14 shrink-0 flex-col items-center self-start overflow-hidden rounded-xl border text-center ${
        muted ? "border-mist bg-ivory text-plum-soft" : "border-wine/15 bg-white text-plum"
      }`}
    >
      <span
        className={`w-full py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
          muted ? "bg-mist/70 text-plum-soft" : "bg-wine text-white"
        }`}
      >
        {month}
      </span>
      <span className="pt-1 text-[1.35rem] font-semibold leading-none tabular-nums">{day}</span>
      <span className="pb-1.5 pt-0.5 text-[11px] text-plum-soft">{weekday}</span>
    </span>
  );
}

export function EmptyState() {
  const { tr } = useLang();
  return (
    <div className="mt-6 rounded-[20px] border border-mist bg-white px-6 py-12 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-wine-soft text-wine">
        <Ico name="cal" className="h-6 w-6" />
      </span>
      <p className="mt-4 font-display text-[1.4rem] text-plum">{tr.noApptsYet}</p>
      <p className="mt-1 text-plum-soft">{tr.noApptsYetSub}</p>
      <BookLink href={site.bookCta} className={`${PRIMARY} mt-6`}>
        <Ico name="cal" className="h-4 w-4" />
        {tr.bookTitle}
      </BookLink>
    </div>
  );
}

export type CancelControls = {
  busy: boolean;
  confirming: boolean;
  onAskCancel: () => void;
  onDismiss: () => void;
  onCancel: () => void;
};

export const PRIMARY =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-wine px-5 text-[15px] font-medium text-white shadow-[0_10px_24px_-14px_rgba(124,44,62,.9)] transition hover:bg-wine-deep";
const ACTION =
  "focus-ring inline-flex min-h-10 items-center gap-2 rounded-full border border-mist bg-white px-3.5 text-[14px] font-medium text-plum transition hover:border-plum/40 hover:bg-ivory";
const CANCEL =
  "focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-wine transition hover:bg-wine-soft";

function CancelConfirm({ busy, onDismiss, onCancel }: CancelControls) {
  const { tr } = useLang();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 bg-wine-soft px-5 py-3"
    >
      <p className="text-[15px] font-medium text-wine-deep">{tr.cancelConfirm}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="focus-ring min-h-10 rounded-full border border-wine/30 bg-white px-4 text-[14px] font-medium text-wine transition hover:bg-wine-soft"
        >
          {tr.keepIt}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="focus-ring min-h-10 rounded-full bg-wine px-4 text-[14px] font-medium text-white transition hover:bg-wine-deep disabled:opacity-60"
        >
          {busy ? tr.cancelling : tr.yesCancel}
        </button>
      </div>
    </div>
  );
}

function CancelButton({ onAskCancel }: CancelControls) {
  const { tr } = useLang();
  return (
    <button type="button" onClick={onAskCancel} className={`${CANCEL} sm:ml-auto`}>
      <Ico name="close" className="h-4 w-4" />
      {tr.cancelAppointment}
    </button>
  );
}

/** Check-in status with a link to the form — shown on upcoming visits. */
export function CheckInLink({ booking }: { booking: MyBooking }) {
  const { tr } = useLang();
  const done = Boolean(booking.intake?.submittedAt);
  return (
    <Link
      href={`/appointment/${booking.manageToken}/check-in`}
      className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition ${
        done
          ? "border border-sage-ink/20 bg-sage-soft text-sage-ink hover:border-sage-ink"
          : "bg-wine text-white hover:bg-wine-deep"
      }`}
    >
      <Ico name={done ? "check" : "shield"} className="h-4 w-4" />
      {done ? tr.checkInEdit : tr.checkInStart}
    </Link>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-stone">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function NextCard({ booking, ...controls }: { booking: MyBooking } & CancelControls) {
  const { lang, tr } = useLang();
  const countdown = useCountdown();
  const provider = providerById(booking.providerId);
  const office = officeById(booking.officeId);
  const checkedIn = Boolean(booking.intake?.submittedAt);

  return (
    <article className="overflow-hidden rounded-[20px] border border-mist bg-white shadow-[0_18px_40px_-28px_rgba(36,28,32,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-night px-5 py-4 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/12 px-3 py-1 text-[13px] font-semibold">
            {countdown(booking.date)}
          </span>
          <p className="font-display text-[clamp(1.3rem,2.6vw,1.6rem)] leading-tight">
            {upperFirst(longDate(booking.date, lang))}
          </p>
        </div>
        <p className="font-display text-[clamp(1.3rem,2.6vw,1.6rem)] leading-tight">
          {booking.time.toUpperCase()}
          <span className="ml-1.5 font-sans text-[13px] text-white/60">{practice.timezone}</span>
        </p>
      </div>

      <div className="grid gap-5 px-5 py-5 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr] md:gap-6">
        <Detail label={tr.provider}>
          <div className="flex items-center gap-3">
            {provider ? (
              <ProviderAvatar provider={provider} size="xs" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-wine-soft text-wine">
                <Ico name="heart" className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <p className="font-medium leading-snug text-plum">{provider?.name ?? practice.name}</p>
              {provider && <p className="text-[13px] text-plum-soft">{provider.cred}</p>}
            </div>
          </div>
        </Detail>
        <Detail label={tr.location}>
          <p className="font-medium leading-snug text-plum">{office?.name ?? practice.name}</p>
          <p className="text-[13px] text-plum-soft">{bookingAddress(booking)}</p>
        </Detail>
        <Detail label={tr.visit}>
          <p className="font-medium leading-snug text-plum">{reasonLabel(booking.reason, lang)}</p>
          <p className="text-[13px] text-plum-soft">
            {booking.insurance
              ? `${booking.insurance.carrier} · ${booking.insurance.plan}`
              : tr.selfPay}
          </p>
          <p className="text-[13px] text-plum-soft">
            {booking.patientType === "new" ? tr.newPatient : tr.existingPatient}
          </p>
        </Detail>
      </div>

      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5 sm:px-6 ${
          checkedIn ? "border-mist bg-sage-soft/50" : "border-wine/10 bg-wine-soft/60"
        }`}
      >
        <p className="flex min-w-[16rem] flex-1 items-start gap-2 text-[14px] text-plum-soft">
          <Ico
            name={checkedIn ? "check" : "shield"}
            className={`mt-0.5 h-4 w-4 shrink-0 ${checkedIn ? "text-sage-ink" : "text-wine"}`}
          />
          <span>
            <span className="font-semibold text-plum">{tr.checkIn}:</span>{" "}
            {checkedIn ? tr.checkInDone : tr.checkInWhy}
          </span>
        </p>
        <CheckInLink booking={booking} />
      </div>

      {controls.confirming ? (
        <CancelConfirm {...controls} />
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-mist px-5 py-3.5 sm:px-6">
          <button type="button" onClick={() => downloadCalendarFile(booking)} className={ACTION}>
            <Ico name="cal" className="h-4 w-4" />
            {tr.addToCalendar}
          </button>
          {office && (
            <a href={office.maps} target="_blank" rel="noreferrer" className={ACTION}>
              <Ico name="pin" className="h-4 w-4" />
              {tr.directions}
            </a>
          )}
          <Link href={bookHref(booking, true)} className={ACTION}>
            <Ico name="clock" className="h-4 w-4" />
            {tr.reschedule}
          </Link>
          <CancelButton {...controls} />
        </div>
      )}
    </article>
  );
}

/** One upcoming visit with everything the patient can do about it. */
export function UpcomingRow({ booking, ...controls }: { booking: MyBooking } & CancelControls) {
  const { lang, tr } = useLang();
  const countdown = useCountdown();
  const provider = providerById(booking.providerId);
  const office = officeById(booking.officeId);
  return (
    <article className="overflow-hidden rounded-[20px] border border-mist bg-white">
      <div className="flex gap-4 p-4 sm:p-5">
        <DateBadge date={booking.date} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="font-semibold text-plum">
              {upperFirst(longDate(booking.date, lang))} ·{" "}
              {booking.time.toUpperCase()}
            </p>
            <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-[13px] font-medium text-sage-ink">
              {countdown(booking.date)}
            </span>
          </div>
          <p className="mt-0.5 text-[14px] text-plum">{reasonLabel(booking.reason, lang)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px] text-plum-soft">
            {provider && (
              <span className="flex items-center gap-2">
                <ProviderAvatar provider={provider} size="xs" />
                {provider.name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Ico name="pin" className="h-4 w-4 text-wine" />
              {office?.name ?? practice.name}
            </span>
          </div>
        </div>
      </div>
      {controls.confirming ? (
        <CancelConfirm {...controls} />
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-mist bg-ivory/60 px-4 py-3 sm:px-5">
          <CheckInLink booking={booking} />
          <button type="button" onClick={() => downloadCalendarFile(booking)} className={ACTION}>
            <Ico name="cal" className="h-4 w-4" />
            {tr.addToCalendar}
          </button>
          <Link href={bookHref(booking, true)} className={ACTION}>
            <Ico name="clock" className="h-4 w-4" />
            {tr.reschedule}
          </Link>
          <CancelButton {...controls} />
        </div>
      )}
    </article>
  );
}

/** A short line for lists: date leaf, time, who and where — opens its page. */
export function CompactRow({ booking }: { booking: MyBooking }) {
  const { lang, tr } = useLang();
  const countdown = useCountdown();
  const provider = providerById(booking.providerId);
  const checkedIn = Boolean(booking.intake?.submittedAt);
  return (
    <li>
      <Link
        href={`/appointment/${booking.manageToken}`}
        className="focus-ring flex items-center gap-4 px-4 py-3.5 transition hover:bg-ivory sm:px-5"
      >
        <DateBadge date={booking.date} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-plum">
            {booking.time.toUpperCase()}{" "}
            <span className="font-normal text-plum-soft">· {countdown(booking.date)}</span>
          </p>
          <p className="truncate text-[14px] text-plum-soft">
            {provider ? `${shortName(provider.name)} · ` : ""}
            {officeById(booking.officeId)?.name ?? practice.name}
          </p>
          <p className="truncate text-[14px] text-plum-soft">{reasonLabel(booking.reason, lang)}</p>
        </div>
        <span
          className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium sm:inline-flex ${
            checkedIn ? "bg-sage-soft text-sage-ink" : "bg-wine-soft text-wine-deep"
          }`}
        >
          <Ico name={checkedIn ? "check" : "shield"} className="h-3.5 w-3.5" />
          {tr.checkIn}
        </span>
        <Ico name="chev" className="h-4 w-4 shrink-0 -rotate-90 text-stone" />
      </Link>
    </li>
  );
}

export function HistoryRow({ booking }: { booking: MyBooking }) {
  const { lang, tr } = useLang();
  const cancelled = booking.status === "cancelled";
  const provider = providerById(booking.providerId);
  return (
    <li className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
      <DateBadge date={booking.date} muted />
      <div className="min-w-0 flex-1">
        <p
          className={`font-semibold ${cancelled ? "text-plum-soft line-through decoration-plum/30" : "text-plum"}`}
        >
          {booking.time.toUpperCase()} · {reasonLabel(booking.reason, lang)}
        </p>
        <p className="truncate text-[14px] text-plum-soft">
          {provider ? `${provider.name} · ` : ""}
          {officeById(booking.officeId)?.name ?? practice.name}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
            cancelled ? "bg-wine-soft text-wine-deep" : "bg-sage-soft text-sage-ink"
          }`}
        >
          {cancelled ? tr.apptStatusCancelled : tr.completed}
        </span>
        <BookLink
          href={bookHref(booking)}
          className="focus-ring hidden min-h-10 items-center rounded-full border border-mist bg-white px-3.5 text-[14px] font-medium text-plum transition hover:border-plum/40 sm:inline-flex"
        >
          {tr.bookAgain}
        </BookLink>
      </div>
    </li>
  );
}
