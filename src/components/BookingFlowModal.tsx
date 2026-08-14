"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { practice } from "@/lib/practice";
import { addDays, buildWindow, formatShort, type DaySlots } from "@/lib/availability";
import { useBooking } from "./booking-context";
import VisitReasonSelect from "./VisitReasonSelect";
import { CheckIcon, CloseIcon, InfoIcon, PinIcon, ShieldSmall } from "./icons";

const WINDOW = 14;

type Step = "details" | "about" | "done";

export default function BookingFlowModal({
  initialIso,
  onClose,
}: {
  initialIso: string | null;
  onClose: () => void;
}) {
  const { todayIso, reason, setReason, insurance, insuranceChosen, patientType, openInsurance } =
    useBooking();

  const days = useMemo(
    () => buildWindow(todayIso, todayIso, patientType, reason, WINDOW),
    [todayIso, patientType, reason],
  );
  const openDays = days.filter((day) => day.slots.length > 0);

  const [step, setStep] = useState<Step>("details");
  const [time, setTime] = useState<string | null>(null);
  const [dayIso, setDayIso] = useState<string | null>(initialIso);

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  // Changing the visit reason reshuffles availability, so the highlighted day is
  // derived rather than stored — it falls back to the next day with openings.
  const requested = dayIso ? days.find((day) => day.iso === dayIso) : undefined;
  const featured = requested?.slots.length ? requested : (openDays[0] ?? null);
  const rest = openDays.filter((day) => day.iso !== featured?.iso);
  const restStart = featured ? addDays(featured.iso, 1) : todayIso;
  const restEnd = addDays(todayIso, WINDOW - 1);

  function chooseTime(iso: string, value: string) {
    setDayIso(iso);
    setTime(value);
    setStep("about");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Book an appointment"
        className="flex max-h-[94vh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <h2 className="text-[24px] font-bold tracking-tight">
            {step === "details" && "Book an appointment"}
            {step === "about" && "Confirm your details"}
            {step === "done" && "Appointment requested"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring -mr-1 rounded-full p-1.5 text-ink transition hover:bg-cream-deep"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {step === "details" && (
            <>
              <ProviderHeader />

              <h3 className="mt-6 text-[19px] font-bold tracking-tight">Scheduling details</h3>
              <p className="mt-0.5 text-[15px] text-muted">
                Your selections will help show the right availability
              </p>
              <div className="mt-3 space-y-2.5">
                <VisitReasonSelect value={reason} onChange={setReason} withIcon />
                <button
                  type="button"
                  onClick={openInsurance}
                  className="focus-ring flex w-full items-center gap-2.5 rounded-lg border border-line-strong bg-white px-3.5 py-3 text-left text-[16px] transition hover:border-ink/40"
                >
                  <ShieldSmall className="h-5 w-5 shrink-0" />
                  <span className="truncate">
                    {insurance
                      ? `${insurance.carrier} · ${insurance.plan}`
                      : insuranceChosen
                        ? "I'm paying for myself"
                        : "Insurance carrier and plan"}
                  </span>
                </button>
              </div>

              <h3 className="mt-6 text-[19px] font-bold tracking-tight">Available appointments</h3>
              <p className="mt-0.5 text-[15px] text-muted">Click a time to book for free.</p>

              {featured ? (
                <div className="mt-4">
                  <p className="text-[16px] font-semibold">{formatShort(featured.iso)}</p>
                  <SlotRow day={featured} onPick={chooseTime} />
                </div>
              ) : (
                <p className="mt-4 text-[15px] text-muted">
                  No available appointments in the next two weeks. Call {practice.phone} and the
                  office will find you a time.
                </p>
              )}

              <h3 className="mt-7 text-[19px] font-bold tracking-tight">More availability</h3>
              <p className="mt-2 text-[16px] font-semibold">
                {formatShort(restStart)} – {formatShort(restEnd)}
              </p>
              {rest.length === 0 ? (
                <p className="mt-2 text-[15px] text-muted">No available appointments</p>
              ) : (
                <div className="mt-2 space-y-4">
                  {rest.map((day) => (
                    <div key={day.iso}>
                      <p className="text-[15px] font-semibold">{formatShort(day.iso)}</p>
                      <SlotRow day={day} onPick={chooseTime} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "about" && featured && time && (
            <AboutYouStep
              iso={featured.iso}
              time={time}
              reason={reason}
              onBack={() => setStep("details")}
              onSubmit={() => setStep("done")}
            />
          )}

          {step === "done" && featured && time && (
            <DoneStep
              iso={featured.iso}
              time={time}
              reason={reason}
              patientType={patientType}
              insurance={insurance ? `${insurance.carrier} · ${insurance.plan}` : "Paying for myself"}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SlotRow({
  day,
  onPick,
}: {
  day: DaySlots;
  onPick: (iso: string, time: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {day.slots.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onPick(day.iso, slot)}
          className="focus-ring rounded-md border border-teal/25 bg-gold px-3.5 py-2 text-[15px] font-medium text-teal transition hover:border-teal/50 hover:bg-gold-deep"
        >
          {slot}
        </button>
      ))}
    </div>
  );
}

function ProviderHeader() {
  return (
    <div className="flex gap-4">
      <Image
        src="/logo.png"
        alt={practice.photoAlt}
        width={72}
        height={72}
        className="h-18 w-18 shrink-0 rounded-lg border border-line bg-white object-contain p-1"
      />
      <div>
        <p className="text-[19px] font-bold leading-snug tracking-tight">{practice.name}</p>
        <p className="text-[16px] text-ink-soft">{practice.specialty}</p>
        <p className="mt-1 flex items-start gap-1.5 text-[15px]">
          <PinIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {practice.addressFull}
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ iso, time, reason }: { iso: string; time: string; reason: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line-strong p-4">
      <Image
        src="/logo.png"
        alt={practice.photoAlt}
        width={78}
        height={78}
        className="h-13 w-13 shrink-0 rounded-lg border border-line bg-white object-contain p-1"
      />
      <div className="text-[15px] leading-relaxed">
        <p className="text-[17px] font-bold tracking-tight">{practice.name}</p>
        <p className="text-ink-soft">{practice.specialty}</p>
        <p className="font-medium">
          {formatShort(iso)} at {time.toUpperCase()} {practice.timezone}
        </p>
        <p className="text-ink-soft">{practice.addressFull}</p>
        <p className="text-ink-soft">{reason}</p>
      </div>
    </div>
  );
}

function AboutYouStep({
  iso,
  time,
  reason,
  onBack,
  onSubmit,
}: {
  iso: string;
  time: string;
  reason: string;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [more, setMore] = useState(false);
  const field =
    "focus-ring w-full rounded-lg border border-line-strong bg-white px-3.5 py-3 text-[16px] placeholder:text-muted";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <SummaryCard iso={iso} time={time} reason={reason} />

      <h3 className="mt-6 text-[28px] font-bold leading-tight tracking-tight">
        Tell us a bit about you
      </h3>
      <p className="mt-1.5 text-[16px] text-ink-soft">
        To book your appointment, we need to verify a few things for the office
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">Email</span>
          <input required type="email" className={field} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
              Legal first name
              <InfoIcon className="h-4 w-4 text-muted" />
            </span>
            <input required className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
              Legal last name
              <InfoIcon className="h-4 w-4 text-muted" />
            </span>
            <input required className={field} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">Date of birth</span>
          <input required placeholder="mm/dd/yyyy" inputMode="numeric" className={field} />
        </label>

        <fieldset>
          <legend className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
            Sex
            <InfoIcon className="h-4 w-4 text-muted" />
          </legend>
          <div className="space-y-2">
            {["Male", "Female"].map((option) => (
              <label key={option} className="flex items-center gap-2.5 text-[16px]">
                <input required type="radio" name="sex" value={option} className="h-4 w-4 accent-ink" />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <button
            type="button"
            onClick={() => setMore((prev) => !prev)}
            className="focus-ring text-[15px] font-medium link-underline"
          >
            {more ? "Hide sex & gender info" : "Add more sex & gender info"}
          </button>
          <span className="ml-1.5 text-[15px] text-muted">(optional)</span>

          {more && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[15px] font-semibold">Gender identity</span>
                <input className={field} placeholder="e.g. Woman, Man, Non-binary" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[15px] font-semibold">Pronouns</span>
                <input className={field} placeholder="e.g. she/her, they/them" />
              </label>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="focus-ring mt-6 w-full rounded-lg bg-wine px-4 py-3.5 text-[17px] font-semibold text-white transition hover:bg-wine-deep"
      >
        Continue
      </button>
      <button
        type="button"
        onClick={onBack}
        className="focus-ring mt-3 w-full text-[15px] font-medium link-underline"
      >
        Back to available times
      </button>
    </form>
  );
}

function DoneStep({
  iso,
  time,
  reason,
  patientType,
  insurance,
  onClose,
}: {
  iso: string;
  time: string;
  reason: string;
  patientType: string;
  insurance: string;
  onClose: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col items-center py-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft">
          <CheckIcon className="h-8 w-8 text-teal" />
        </span>
        <h3 className="mt-4 text-[24px] font-bold tracking-tight">You&apos;re booked</h3>
        <p className="mt-1.5 max-w-sm text-[15px] text-ink-soft">
          {practice.name} will call if anything about this visit needs to change. A confirmation
          email is on its way.
        </p>
      </div>

      <dl className="mt-5 space-y-2 rounded-xl bg-cream px-4 py-4 text-[15px]">
        <Row label="When" value={`${formatShort(iso)} at ${time.toUpperCase()} ${practice.timezone}`} />
        <Row label="Visit reason" value={reason} />
        <Row label="Patient" value={patientType === "new" ? "New patient" : "Existing patient"} />
        <Row label="Insurance" value={insurance} />
        <Row label="Where" value={practice.addressFull} />
      </dl>

      <button
        type="button"
        onClick={onClose}
        className="focus-ring mt-6 w-full rounded-lg bg-wine px-4 py-3.5 text-[17px] font-semibold text-white transition hover:bg-wine-deep"
      >
        Done
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
