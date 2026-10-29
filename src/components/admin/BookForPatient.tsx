"use client";

import { getProviders } from "@/lib/providers";
import { useEffect, useRef, useState } from "react";
import { DateInput } from "@/components/form-fields";
import { formatShort, type DayAvailability } from "@/lib/availability";
import type { Booking } from "@/lib/models";
import { carriers, plansFor, visitReasons } from "@/lib/practice";
import { officeById, shortProviderName, type ProviderId } from "@/lib/scheduling";
import { BTN_PRIMARY, BTN_QUIET, FIELD, LABEL, Notice } from "./ui";

const REASONS = [...visitReasons.popular, ...visitReasons.all];
/** How far ahead staff can book from this popup. */
const DAYS = 28;

type Form = {
  providerId: ProviderId;
  reason: string;
  slotId: string;
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  sex: string;
  patientType: "new" | "existing";
  carrier: string;
  plan: string;
  lang: "en" | "es";
};

/**
 * "Book for a patient" — staff put a patient into an open time (phone call,
 * front desk, the doctor's own panel). With `providerId` set, only that
 * provider's times are offered; otherwise the admin picks the provider.
 */
export default function BookForPatient({
  providerId,
  onBooked,
}: {
  providerId?: ProviderId;
  onBooked: (booking: Booking, emailed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const blank = (): Form => ({
    providerId: providerId ?? getProviders()[0].id,
    reason: REASONS[0],
    slotId: "",
    firstName: "",
    lastName: "",
    email: "",
    dob: "",
    sex: "Female",
    patientType: "existing",
    carrier: "",
    plan: "",
    lang: "en",
  });
  const [form, setForm] = useState<Form>(blank);
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Open times for the chosen provider and reason, while the popup is open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const today = new Date(Date.now() - 7 * 3600_000).toISOString().slice(0, 10);
    const params = new URLSearchParams({
      start: today,
      days: String(DAYS),
      provider: form.providerId,
      reason: form.reason,
    });
    fetch(`/api/availability?${params}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { days?: DayAvailability[] }) => {
        if (!cancelled) setDays((data.days ?? []).filter((day) => day.slots.length > 0));
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, form.providerId, form.reason]);

  function show() {
    setForm(blank());
    setDays(null);
    setError("");
    setOpen(true);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.slotId) {
      setError("Pick a time");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/doctor/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: form.slotId,
          reason: form.reason,
          patientType: form.patientType,
          lang: form.lang,
          insurance: form.carrier ? { carrier: form.carrier, plan: form.plan } : null,
          patient: {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            dob: form.dob,
            sex: form.sex,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not book");
        return;
      }
      onBooked(data.booking, Boolean(data.emailed));
      close();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  const plans = form.carrier ? plansFor(form.carrier) : [];

  return (
    <>
      <button type="button" onClick={show} className={BTN_PRIMARY}>
        <span aria-hidden className="text-[18px] leading-none">
          +
        </span>
        Book for a patient
      </button>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="book-patient-title"
        className="m-auto w-[min(620px,calc(100vw-32px))] rounded-2xl border border-mist bg-white p-0 text-plum shadow-[0_24px_60px_-20px_rgba(44,32,38,.45)] backdrop:bg-plum/40"
      >
        <form onSubmit={submit} className="max-h-[calc(100dvh-48px)] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="book-patient-title" className="font-display text-[1.35rem] font-semibold">
                Book for a patient
              </h2>
              <p className="mt-0.5 text-[13px] text-plum-soft">
                The patient gets the usual confirmation email, with check-in and reminders.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="focus-ring -mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[22px] leading-none text-plum-soft transition hover:bg-shell hover:text-plum"
            >
              ×
            </button>
          </div>

          <fieldset className="mt-5 space-y-3">
            <legend className="text-[13px] font-bold uppercase tracking-wide text-plum-soft">
              Appointment
            </legend>
            <div className={`grid gap-3 ${providerId ? "" : "sm:grid-cols-2"}`}>
              {!providerId && (
                <div>
                  <label className={LABEL} htmlFor="bp-provider">
                    Provider
                  </label>
                  <select
                    id="bp-provider"
                    value={form.providerId}
                    onChange={(event) => {
                      set("providerId", event.target.value as ProviderId);
                      set("slotId", "");
                      setDays(null);
                    }}
                    className={FIELD}
                  >
                    {getProviders().map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={LABEL} htmlFor="bp-reason">
                  Visit reason
                </label>
                <select
                  id="bp-reason"
                  value={form.reason}
                  onChange={(event) => {
                    set("reason", event.target.value);
                    set("slotId", "");
                    setDays(null);
                  }}
                  className={FIELD}
                >
                  {REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="bp-slot">
                Time
              </label>
              <select
                id="bp-slot"
                required
                value={form.slotId}
                onChange={(event) => set("slotId", event.target.value)}
                className={FIELD}
                disabled={days === null}
              >
                <option value="" disabled>
                  {days === null
                    ? "Loading open times…"
                    : days.length === 0
                      ? `No open times in the next ${DAYS / 7} weeks`
                      : "Choose a time…"}
                </option>
                {(days ?? []).map((day) => (
                  <optgroup key={day.iso} label={formatShort(day.iso)}>
                    {day.slots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.time} · {officeById(slot.officeId)?.name ?? "—"}
                        {providerId ? "" : ` · ${shortProviderName(slot.providerId)}`}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </fieldset>

          <fieldset className="mt-5 space-y-3">
            <legend className="text-[13px] font-bold uppercase tracking-wide text-plum-soft">
              Patient
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="bp-first">
                  First name
                </label>
                <input
                  id="bp-first"
                  required
                  value={form.firstName}
                  onChange={(event) => set("firstName", event.target.value)}
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="bp-last">
                  Last name
                </label>
                <input
                  id="bp-last"
                  required
                  value={form.lastName}
                  onChange={(event) => set("lastName", event.target.value)}
                  className={FIELD}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor="bp-email">
                  Email
                </label>
                <input
                  id="bp-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => set("email", event.target.value)}
                  className={FIELD}
                  placeholder="For the confirmation and reminders"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="bp-dob">
                  Date of birth
                </label>
                <DateInput
                  id="bp-dob"
                  required
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.dob}
                  onChange={(event) => set("dob", event.target.value)}
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="bp-sex">
                  Sex
                </label>
                <select
                  id="bp-sex"
                  value={form.sex}
                  onChange={(event) => set("sex", event.target.value)}
                  className={FIELD}
                >
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="bp-type">
                  Patient type
                </label>
                <select
                  id="bp-type"
                  value={form.patientType}
                  onChange={(event) =>
                    set("patientType", event.target.value as Form["patientType"])
                  }
                  className={FIELD}
                >
                  <option value="existing">Existing patient</option>
                  <option value="new">New patient</option>
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="bp-lang">
                  Emails in
                </label>
                <select
                  id="bp-lang"
                  value={form.lang}
                  onChange={(event) => set("lang", event.target.value as Form["lang"])}
                  className={FIELD}
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="bp-carrier">
                  Insurance
                </label>
                <select
                  id="bp-carrier"
                  value={form.carrier}
                  onChange={(event) => {
                    set("carrier", event.target.value);
                    set("plan", event.target.value ? plansFor(event.target.value)[0] : "");
                  }}
                  className={FIELD}
                >
                  <option value="">Self-pay</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.name} value={carrier.name}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="bp-plan">
                  Plan
                </label>
                <select
                  id="bp-plan"
                  value={form.plan}
                  disabled={!form.carrier}
                  onChange={(event) => set("plan", event.target.value)}
                  className={FIELD}
                >
                  {!form.carrier && <option value="">—</option>}
                  {plans.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <Notice tone="error">{error}</Notice>

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={close} className={`${BTN_QUIET} flex-1 py-2.5`}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={`${BTN_PRIMARY} flex-1`}>
              {busy ? "Booking…" : "Book appointment"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
