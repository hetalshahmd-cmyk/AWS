"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { practice } from "@/lib/practice";
import { addDays, formatShort, type DayAvailability } from "@/lib/availability";
import { useSession } from "./auth/session-context";
import { fetchAvailability, useBooking } from "./booking-context";
import VisitReasonSelect from "./VisitReasonSelect";
import { CheckIcon, CloseIcon, InfoIcon, PinIcon, ShieldSmall } from "./icons";

const WINDOW = 14;

type Step = "details" | "about" | "done";
type Picked = { iso: string; slotId: string; time: string };

export default function BookingFlowModal({
  initialIso,
  onClose,
}: {
  initialIso: string | null;
  onClose: () => void;
}) {
  const {
    todayIso,
    reason,
    setReason,
    insurance,
    insuranceChosen,
    patientType,
    openInsurance,
    bumpVersion,
  } = useBooking();

  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<Step>("details");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [dayIso, setDayIso] = useState<string | null>(initialIso);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetchAvailability(todayIso, WINDOW)
      .then((result) => {
        if (!cancelled) setDays(result);
      })
      .catch(() => {
        if (!cancelled) {
          setDays([]);
          setLoadError("Availability is unavailable right now. Please call the office.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [todayIso, reloadKey]);

  const openDays = (days ?? []).filter((day) => day.slots.length > 0);
  const requested = dayIso ? (days ?? []).find((day) => day.iso === dayIso) : undefined;
  const featured = requested?.slots.length ? requested : (openDays[0] ?? null);
  const rest = openDays.filter((day) => day.iso !== featured?.iso);
  const restStart = featured ? addDays(featured.iso, 1) : todayIso;
  const restEnd = addDays(todayIso, WINDOW - 1);

  function chooseTime(iso: string, slotId: string, time: string) {
    setDayIso(iso);
    setPicked({ iso, slotId, time });
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
            {step === "done" && "Appointment booked"}
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

              {days === null ? (
                <p className="mt-4 text-[15px] text-muted">Loading availability…</p>
              ) : featured ? (
                <div className="mt-4">
                  <p className="text-[16px] font-semibold">{formatShort(featured.iso)}</p>
                  <SlotRow day={featured} onPick={chooseTime} />
                </div>
              ) : (
                <p className="mt-4 text-[15px] text-muted">
                  {loadError ||
                    `No available appointments in the next two weeks. Call ${practice.phone} and the office will find you a time.`}
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

          {step === "about" && picked && (
            <AboutYouStep
              picked={picked}
              reason={reason}
              patientType={patientType}
              insurance={insurance}
              onBack={() => setStep("details")}
              onBooked={() => {
                bumpVersion();
                setStep("done");
              }}
              onSlotGone={() => {
                setReloadKey((key) => key + 1);
                setPicked(null);
                setStep("details");
              }}
            />
          )}

          {step === "done" && picked && (
            <DoneStep
              picked={picked}
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
  day: DayAvailability;
  onPick: (iso: string, slotId: string, time: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {day.slots.map((slot) => (
        <button
          key={slot.id}
          type="button"
          onClick={() => onPick(day.iso, slot.id, slot.time)}
          className="focus-ring rounded-md border border-teal/25 bg-gold px-3.5 py-2 text-[15px] font-medium text-teal transition hover:border-teal/50 hover:bg-gold-deep"
        >
          {slot.time}
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

function SummaryCard({ picked, reason }: { picked: Picked; reason: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line-strong p-4">
      <Image
        src="/logo.png"
        alt={practice.photoAlt}
        width={52}
        height={52}
        className="h-13 w-13 shrink-0 rounded-lg border border-line bg-white object-contain p-1"
      />
      <div className="text-[15px] leading-relaxed">
        <p className="text-[17px] font-bold tracking-tight">{practice.name}</p>
        <p className="text-ink-soft">{practice.specialty}</p>
        <p className="font-medium">
          {formatShort(picked.iso)} at {picked.time.toUpperCase()} {practice.timezone}
        </p>
        <p className="text-ink-soft">{practice.addressFull}</p>
        <p className="text-ink-soft">{reason}</p>
      </div>
    </div>
  );
}

function AboutYouStep({
  picked,
  reason,
  patientType,
  insurance,
  onBack,
  onBooked,
  onSlotGone,
}: {
  picked: Picked;
  reason: string;
  patientType: "new" | "existing";
  insurance: { carrier: string; plan: string } | null;
  onBack: () => void;
  onBooked: () => void;
  onSlotGone: () => void;
}) {
  const { user } = useSession();
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Signed-in patients get their details filled in — still editable.
  const [form, setForm] = useState(() => {
    const [firstName = "", ...restOfName] = (user?.name ?? "").trim().split(/\s+/);
    return {
      email: user?.email ?? "",
      firstName,
      lastName: restOfName.join(" "),
      dob: "",
      sex: "",
      genderIdentity: "",
      pronouns: "",
    };
  });

  const field =
    "focus-ring w-full rounded-lg border border-line-strong bg-white px-3.5 py-3 text-[16px] placeholder:text-muted";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: picked.slotId,
          reason,
          patientType,
          insurance,
          patient: form,
        }),
      });
      const data = await response.json();

      if (response.status === 409) {
        setError(data.error ?? "That time was just taken.");
        setTimeout(onSlotGone, 1200);
        return;
      }
      if (!response.ok) {
        setError(data.error ?? "Could not save the booking");
        return;
      }
      onBooked();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <SummaryCard picked={picked} reason={reason} />

      <h3 className="mt-6 text-[28px] font-bold leading-tight tracking-tight">
        Tell us a bit about you
      </h3>
      <p className="mt-1.5 text-[16px] text-ink-soft">
        To book your appointment, we need to verify a few things for the office
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className={field}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
              Legal first name
              <InfoIcon className="h-4 w-4 text-muted" />
            </span>
            <input
              required
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              className={field}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
              Legal last name
              <InfoIcon className="h-4 w-4 text-muted" />
            </span>
            <input
              required
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              className={field}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">Date of birth</span>
          <input
            required
            placeholder="mm/dd/yyyy"
            inputMode="numeric"
            value={form.dob}
            onChange={(event) => setForm({ ...form, dob: event.target.value })}
            className={field}
          />
        </label>

        <fieldset>
          <legend className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
            Sex
            <InfoIcon className="h-4 w-4 text-muted" />
          </legend>
          <div className="space-y-2">
            {["Male", "Female"].map((option) => (
              <label key={option} className="flex items-center gap-2.5 text-[16px]">
                <input
                  required
                  type="radio"
                  name="sex"
                  value={option}
                  checked={form.sex === option}
                  onChange={(event) => setForm({ ...form, sex: event.target.value })}
                  className="h-4 w-4 accent-wine"
                />
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
                <input
                  value={form.genderIdentity}
                  onChange={(event) => setForm({ ...form, genderIdentity: event.target.value })}
                  className={field}
                  placeholder="e.g. Woman, Man, Non-binary"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[15px] font-semibold">Pronouns</span>
                <input
                  value={form.pronouns}
                  onChange={(event) => setForm({ ...form, pronouns: event.target.value })}
                  className={field}
                  placeholder="e.g. she/her, they/them"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-wine-soft px-3 py-2 text-[15px] text-wine-deep">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="focus-ring mt-6 w-full rounded-lg bg-wine px-4 py-3.5 text-[17px] font-semibold text-white transition hover:bg-wine-deep disabled:opacity-60"
      >
        {busy ? "Booking…" : "Continue"}
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
  picked,
  reason,
  patientType,
  insurance,
  onClose,
}: {
  picked: Picked;
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
          {practice.name} has your appointment and will call if anything needs to change.
        </p>
      </div>

      <dl className="mt-5 space-y-2 rounded-xl bg-cream px-4 py-4 text-[15px]">
        <Row
          label="When"
          value={`${formatShort(picked.iso)} at ${picked.time.toUpperCase()} ${practice.timezone}`}
        />
        <Row label="Visit reason" value={reason} />
        <Row label="Patient" value={patientType === "new" ? "New patient" : "Existing patient"} />
        <Row label="Insurance" value={insurance} />
        <Row label="Where" value={practice.addressFull} />
      </dl>

      <a
        href="/my-bookings"
        className="focus-ring mt-6 block w-full rounded-lg bg-wine px-4 py-3.5 text-center text-[17px] font-semibold text-white transition hover:bg-wine-deep"
      >
        See my bookings
      </a>
      <button
        type="button"
        onClick={onClose}
        className="focus-ring mt-3 w-full text-[15px] font-medium link-underline"
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
