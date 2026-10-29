"use client";

import Link from "next/link";
import { useState } from "react";
import PhoneLink from "@/components/analytics/PhoneLink";
import { LanguageToggle, useLang } from "@/components/lang-context";
import Ico from "@/components/site/Ico";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import { bookingAddress, downloadCalendarFile } from "@/lib/calendar";
import { longDate, reasonLabel } from "@/lib/i18n";
import { timeToMinutes } from "@/lib/models";
import { practice } from "@/lib/practice";
import { arizonaMinutesNow, arizonaTodayIso, officeById, providerById } from "@/lib/scheduling";
import { site } from "@/lib/site";

/** Only what the appointment page needs — no date of birth, no insurance ids. */
export type AppointmentViewData = {
  id: string;
  date: string;
  time: string;
  reason: string;
  status: "confirmed" | "cancelled";
  providerId: string | null;
  officeId: string | null;
  firstName: string;
  checkedIn: boolean;
};

const ACTION =
  "focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-mist bg-white px-4 text-[14px] font-medium text-plum transition hover:border-plum";

function started(date: string, time: string): boolean {
  const today = arizonaTodayIso();
  if (date !== today) return date < today;
  return timeToMinutes(time) <= arizonaMinutesNow();
}

export default function AppointmentView({
  view,
  token,
}: {
  view: AppointmentViewData;
  token: string;
}) {
  const { lang, tr } = useLang();
  const [status, setStatus] = useState(view.status);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const provider = providerById(view.providerId);
  const office = officeById(view.officeId);
  const past = started(view.date, view.time);
  const active = status === "confirmed" && !past;

  const rescheduleHref = (() => {
    const params = new URLSearchParams({ reschedule: token });
    if (view.providerId) params.set("provider", view.providerId);
    if (view.officeId) params.set("office", view.officeId);
    return `/book?${params}`;
  })();

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/appointments/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? tr.serverDown);
        return;
      }
      setStatus("cancelled");
      setConfirming(false);
    } catch {
      setError(tr.serverDown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div lang={lang}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-wine">
          {tr.yourAppointment}
        </p>
        <LanguageToggle />
      </div>
      <h1 className="mt-3 font-display text-[clamp(2rem,4.5vw,2.8rem)] font-normal leading-tight text-plum">
        {longDate(view.date, lang)}
      </h1>
      <p className="mt-1 text-[1.1rem] text-plum-soft">
        {view.time.toUpperCase()} {practice.timezone} ·{" "}
        <span
          className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${
            status === "cancelled" ? "bg-wine-soft text-wine-deep" : "bg-sage-soft text-sage-ink"
          }`}
        >
          {status === "cancelled" ? tr.apptStatusCancelled : tr.apptStatusConfirmed}
        </span>
      </p>

      <article className="mt-6 overflow-hidden rounded-[24px] border border-mist bg-white">
        <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
          <div className="flex items-center gap-4">
            {provider && <ProviderAvatar provider={provider} size="sm" />}
            <div>
              <p className="font-display text-[1.2rem] leading-tight text-plum">
                {provider?.name ?? practice.name}
              </p>
              <p className="text-[14px] text-plum-soft">{provider?.cred ?? practice.specialty}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Ico name="pin" className="mt-1 h-5 w-5 shrink-0 text-wine" />
            <div>
              <p className="font-medium text-plum">{office?.name ?? practice.name}</p>
              <p className="text-[14px] text-plum-soft">{bookingAddress(view)}</p>
            </div>
          </div>
          <p className="text-[14px] text-plum-soft sm:col-span-2">
            {tr.visitReason}: <span className="font-medium text-plum">{reasonLabel(view.reason, lang)}</span>
          </p>
        </div>

        {active && (
          <div className="flex flex-wrap items-center gap-2 border-t border-mist px-6 py-4">
            <button type="button" onClick={() => downloadCalendarFile(view)} className={ACTION}>
              <Ico name="cal" className="h-4 w-4" />
              {tr.addToCalendar}
            </button>
            {office && (
              <a href={office.maps} target="_blank" rel="noreferrer" className={ACTION}>
                <Ico name="external" className="h-4 w-4" />
                {tr.directions}
              </a>
            )}
            <PhoneLink href={site.phoneHref} className={ACTION}>
              <Ico name="phone" className="h-4 w-4" />
              {tr.callOffice}
            </PhoneLink>
            <Link href={rescheduleHref} className={ACTION}>
              <Ico name="arrow" className="h-4 w-4" />
              {tr.reschedule}
            </Link>
          </div>
        )}
      </article>

      {active && (
        <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-mist bg-ivory p-5">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-10 w-10 place-items-center rounded-full ${
                view.checkedIn ? "bg-sage-soft text-sage-ink" : "bg-wine-soft text-wine"
              }`}
            >
              <Ico name={view.checkedIn ? "check" : "shield"} className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium text-plum">{tr.checkIn}</p>
              <p className="text-[14px] text-plum-soft">
                {view.checkedIn ? tr.checkInDone : tr.checkInWhy}
              </p>
            </div>
          </div>
          <Link
            href={`/appointment/${token}/check-in`}
            className="focus-ring inline-flex min-h-11 items-center rounded-full bg-wine px-5 text-[15px] font-medium text-white transition hover:bg-wine-deep"
          >
            {view.checkedIn ? tr.checkInEdit : tr.checkInStart}
          </Link>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-wine-soft px-4 py-3 text-[15px] text-wine-deep">
          {error}
        </p>
      )}

      {active &&
        (confirming ? (
          <div role="alert" className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-wine-soft px-4 py-3">
            <p className="text-[15px] font-medium text-wine-deep">{tr.cancelConfirm}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={cancel}
                className="focus-ring min-h-11 rounded-full bg-wine px-4 text-[14px] font-medium text-white transition hover:bg-wine-deep disabled:opacity-60"
              >
                {busy ? tr.cancelling : tr.yesCancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="focus-ring min-h-11 rounded-full border border-wine/30 bg-white px-4 text-[14px] font-medium text-wine transition hover:bg-wine-soft"
              >
                {tr.keepIt}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="focus-ring mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-wine underline-offset-4 transition hover:underline"
          >
            <Ico name="close" className="h-4 w-4" />
            {tr.cancelAppointment}
          </button>
        ))}

      {!active && (
        <div className="mt-6 rounded-[20px] border border-mist bg-white p-6 text-center">
          <p className="text-plum-soft">{status === "cancelled" ? tr.cancelledDone : tr.apptStatusPast}</p>
          <Link
            href={view.providerId ? `/about#book-${view.providerId}` : "/about#providers"}
            className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-full bg-wine px-6 font-medium text-white transition hover:bg-wine-deep"
          >
            {tr.bookAnother}
          </Link>
        </div>
      )}

      <p className="mt-8 text-[14px] text-plum-soft">{tr.emailQuestions(site.phone)}</p>
    </div>
  );
}
