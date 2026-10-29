"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import type { DayAvailability, DaySlot } from "@/lib/availability";
import { dateBadge, longDate, reasonLabel, shortDate } from "@/lib/i18n";
import { ALL_VISIT_REASONS, practice, reasonFor } from "@/lib/practice";
import { mondayOf, officeById, providerById, shortProviderName } from "@/lib/scheduling";
import { getOffices } from "@/lib/site-content";
import { newEventId, track } from "./analytics/track";
import { useSession } from "./auth/session-context";
import {
  fetchAvailability,
  useBooking,
  type OfficeChoice,
  type PreselectedSlot,
} from "./booking-context";
import { useLang } from "./lang-context";
import VisitReasonSelect from "./VisitReasonSelect";
import {
  CheckIcon,
  ChevronLeft,
  ChevronRight,
  CloseIcon,
  InfoIcon,
  PinIcon,
  ShieldSmall,
} from "./icons";
import { DateInput, PasswordInput } from "./form-fields";

/** Three calendar weeks, Monday to Sunday, starting with this one. */
const WINDOW = 21;

/** Times, then visit details (reason, insurance, new or existing), about you, done. */
type Step = "details" | "visit" | "about" | "done";
type Picked = {
  iso: string;
  slotId: string;
  time: string;
  providerId: string | null;
  officeId: string | null;
};
/** What the server hands back after a successful booking. */
type Result = {
  manageToken: string;
  emailed: boolean;
  email: string;
  name: string;
  guest: boolean;
  /** When rescheduling: did the server cancel the old appointment? */
  moved: boolean | null;
};

function addressFor(officeId: string | null): string {
  const office = officeById(officeId);
  return office ? office.address.join(", ") : practice.addressFull;
}

export default function BookingFlowModal({
  initialIso,
  initialSlot = null,
  onClose,
}: {
  initialIso: string | null;
  /** A time picked before the modal opened — start at "about you". */
  initialSlot?: PreselectedSlot | null;
  onClose: () => void;
}) {
  const {
    todayIso,
    reason,
    insurance,
    patientType,
    officeId,
    providerId,
    reschedule,
    clearReschedule,
    bumpVersion,
  } = useBooking();
  const { lang, tr } = useLang();

  const [days, setDays] = useState<DayAvailability[] | null>(null);
  /** Bumped when fresh times arrive, so the week board starts again on their first open week. */
  const [loads, setLoads] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<Step>(initialSlot ? "visit" : "details");
  const [picked, setPicked] = useState<Picked | null>(() =>
    initialSlot
      ? {
          iso: initialSlot.iso,
          slotId: initialSlot.slot.id,
          time: initialSlot.slot.time,
          providerId: initialSlot.slot.providerId,
          officeId: initialSlot.slot.officeId,
        }
      : null,
  );
  const [dayIso, setDayIso] = useState<string | null>(initialIso);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  /** After a reschedule: did the old appointment get cancelled? */
  const [moved, setMoved] = useState<{ label: string; ok: boolean } | null>(null);
  // Each step starts at the top, not where the previous one was scrolled to.
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    // Every open time: the reason is picked afterwards, from that provider's list.
    fetchAvailability(mondayOf(todayIso), WINDOW, { officeId, providerId })
      .then((next) => {
        if (!cancelled) {
          setDays(next);
          setLoads((count) => count + 1);
          setLoadError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDays([]);
          setLoadError(tr.availabilityError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [todayIso, reloadKey, officeId, providerId, tr.availabilityError]);

  /**
   * The new appointment is booked first and the old one cancelled second, so
   * a patient is never left with no appointment if something fails midway.
   */
  /** The server books the new time and cancels the old one in one request. */
  async function finishBooking(next: Result) {
    bumpVersion();
    setResult(next);
    if (reschedule) {
      setMoved({ label: reschedule.label, ok: next.moved === true });
      clearReschedule();
    }
    setStep("done");
  }

  const openDays = (days ?? []).filter((day) => day.slots.length > 0);

  function chooseTime(iso: string, slot: DaySlot) {
    setDayIso(iso);
    setPicked({
      iso,
      slotId: slot.id,
      time: slot.time,
      providerId: slot.providerId,
      officeId: slot.officeId,
    });
    setStep("visit");
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr.modalBook}
        lang={lang}
        className={`flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${
          step === "details" ? "max-w-3xl" : "max-w-xl"
        }`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <h2 className="text-[24px] font-bold tracking-tight">
            {step === "details" && tr.modalBook}
            {step === "visit" && tr.schedulingDetails}
            {step === "about" && tr.modalConfirm}
            {step === "done" && (moved ? tr.appointmentMoved : tr.modalBooked)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr.close}
            className="focus-ring -mr-1 rounded-full p-1.5 text-ink transition hover:bg-cream-deep"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {step === "details" && (
            <>
              <ProviderHeader />
              <OfficePicker />

              <h3 className="mt-6 text-[19px] font-bold tracking-tight">
                {tr.availableAppointments}
              </h3>
              <p className="mt-0.5 text-[15px] text-muted">{tr.clickTime}</p>

              {days === null ? (
                <p className="mt-4 text-[15px] text-muted">{tr.loadingAvailability}</p>
              ) : openDays.length === 0 ? (
                <p className="mt-4 text-[15px] text-muted">
                  {loadError || tr.noneTwoWeeks(practice.phone)}
                </p>
              ) : (
                // Fresh times (e.g. after picking another office) start again at their first open week.
                <WeekBoard key={loads} days={days} startIso={dayIso} onPick={chooseTime} />
              )}
            </>
          )}

          {step === "visit" && picked && (
            <VisitStep
              picked={picked}
              onBack={() => setStep("details")}
              onNext={() => setStep("about")}
            />
          )}

          {step === "about" && picked && (
            <AboutYouStep
              picked={picked}
              reason={reason}
              patientType={patientType}
              insurance={insurance}
              onBack={() => setStep("visit")}
              onBooked={finishBooking}
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
              insurance={insurance ? `${insurance.carrier} · ${insurance.plan}` : tr.payingForMyself}
              moved={moved}
              result={result}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A week at a glance, office by office: the practice's working days (Monday
 * to Friday — a weekend day only when it has times) as columns with every
 * open time under its day (a list of days on phones), arrows between weeks.
 */
function WeekBoard({
  days,
  startIso,
  onPick,
}: {
  days: DayAvailability[];
  /** A day to open on, e.g. the one tapped on a provider card. */
  startIso: string | null;
  onPick: (iso: string, slot: DaySlot) => void;
}) {
  const { lang, tr } = useLang();
  const { officeId, providerId, todayIso: today } = useBooking();
  // `days` starts on this week's Monday: cut it into calendar weeks, keeping
  // Monday–Friday and any weekend day that has open times.
  const weeks = [0, 7, 14]
    .map((start) =>
      days
        .slice(start, start + 7)
        .filter((day) => {
          const weekday = new Date(`${day.iso}T00:00:00Z`).getUTCDay();
          return (weekday >= 1 && weekday <= 5) || day.slots.length > 0;
        }),
    )
    .filter((week) => week.length > 0);
  const [week, setWeek] = useState(() => {
    // The week of the day asked for — if it has open times here; else the first that does.
    const asked = startIso
      ? weeks.findIndex((w) => w.some((day) => day.iso === startIso) && w.some((day) => day.slots.length > 0))
      : -1;
    if (asked >= 0) return asked;
    return Math.max(0, weeks.findIndex((w) => w.some((day) => day.slots.length > 0)));
  });
  const shown = weeks[Math.min(week, weeks.length - 1)] ?? [];
  const offices = getOffices().filter((office) => officeId === "any" || office.id === officeId);
  const showWho = providerId === "any";

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-cream px-2 py-1.5">
        <button
          type="button"
          onClick={() => setWeek((value) => value - 1)}
          disabled={week === 0}
          aria-label={tr.prevWeek}
          className="focus-ring grid h-10 w-10 place-items-center rounded-lg transition hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-center text-[16px] font-semibold" aria-live="polite">
          {shown.length > 0 &&
            `${shortDate(shown[0].iso, lang)} – ${shortDate(shown[shown.length - 1].iso, lang)}`}
        </p>
        <button
          type="button"
          onClick={() => setWeek((value) => value + 1)}
          disabled={week >= weeks.length - 1}
          aria-label={tr.nextWeek}
          className="focus-ring grid h-10 w-10 place-items-center rounded-lg transition hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {offices.map((office) => {
          const perDay = shown.map((day) => ({
            day,
            slots: day.slots.filter((slot) => slot.officeId === office.id),
          }));
          const count = perDay.reduce((sum, entry) => sum + entry.slots.length, 0);
          return (
            <section
              key={office.id}
              aria-label={office.name}
              className="overflow-hidden rounded-xl border border-line-strong"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-line bg-cream/60 px-4 py-3">
                <div className="flex min-w-0 items-start gap-2">
                  <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-wine" />
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold leading-snug">
                      {office.name} <span className="font-normal text-ink-soft">· {office.area}</span>
                    </p>
                    <p className="text-[13px] text-ink-soft">{office.address.join(", ")}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${
                    count > 0 ? "bg-teal-soft text-teal" : "bg-cream-deep text-ink-soft"
                  }`}
                >
                  {tr.openTimesCount(count)}
                </span>
              </div>

              {count === 0 ? (
                <p className="px-4 py-5 text-[15px] text-muted">{tr.noTimesOfficeWeek}</p>
              ) : (
                <>
                  {/* Wider screens: one column per day. */}
                  <div
                    className="hidden gap-1.5 p-3 sm:grid"
                    style={{ gridTemplateColumns: `repeat(${perDay.length}, minmax(0, 1fr))` }}
                  >
                    {perDay.map(({ day, slots }) => {
                      const badge = dateBadge(day.iso, lang);
                      return (
                        <div key={day.iso} className={`min-w-0 ${day.iso < today ? "opacity-45" : ""}`}>
                          <p
                            className={`rounded-md py-1 text-center leading-tight ${
                              day.iso === today ? "bg-ink text-white" : ""
                            }`}
                          >
                            <span className="block text-[13px] font-semibold capitalize">
                              {badge.weekday}
                            </span>
                            <span
                              className={`block text-[12px] ${day.iso === today ? "text-white/80" : "text-ink-soft"}`}
                            >
                              {badge.month} {badge.day}
                            </span>
                          </p>
                          <div className="mt-1.5 space-y-1.5">
                            {slots.length === 0 ? (
                              <p className="py-2 text-center text-[13px] text-muted">—</p>
                            ) : (
                              slots.map((slot) => (
                                <TimeButton
                                  key={slot.id}
                                  iso={day.iso}
                                  slot={slot}
                                  showWho={showWho}
                                  onPick={onPick}
                                  block
                                />
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Phones: one row per day. */}
                  <ul className="divide-y divide-line sm:hidden">
                    {perDay.filter(({ day }) => day.iso >= today).map(({ day, slots }) => (
                      <li key={day.iso} className={`flex gap-3 px-4 ${slots.length ? "py-3" : "py-2"}`}>
                        <p className={`w-[4.5rem] shrink-0 text-[14px] leading-tight ${slots.length ? "pt-1.5" : ""}`}>
                          <span className="block font-semibold capitalize">
                            {dateBadge(day.iso, lang).weekday}
                          </span>
                          <span className="text-ink-soft">
                            {dateBadge(day.iso, lang).month} {dateBadge(day.iso, lang).day}
                          </span>
                        </p>
                        {slots.length === 0 ? (
                          <p className="self-center text-[14px] text-muted">{tr.noTimesShort}</p>
                        ) : (
                          <div className="flex flex-1 flex-wrap gap-1.5">
                            {slots.map((slot) => (
                              <TimeButton
                                key={slot.id}
                                iso={day.iso}
                                slot={slot}
                                showWho={showWho}
                                onPick={onPick}
                              />
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TimeButton({
  iso,
  slot,
  showWho,
  onPick,
  block = false,
}: {
  iso: string;
  slot: DaySlot;
  /** Name the provider under the time when none is chosen yet. */
  showWho: boolean;
  onPick: (iso: string, slot: DaySlot) => void;
  block?: boolean;
}) {
  const { lang } = useLang();
  const who = showWho && slot.providerId ? shortProviderName(slot.providerId) : "";
  const where = officeById(slot.officeId)?.name ?? "";
  return (
    <button
      type="button"
      onClick={() => onPick(iso, slot)}
      aria-label={[shortDate(iso, lang), slot.time.toUpperCase(), who, where].filter(Boolean).join(", ")}
      className={`focus-ring rounded-md border border-teal/25 bg-gold px-2 py-2 text-center text-[14px] font-semibold text-teal transition hover:border-teal/60 hover:bg-gold-deep ${
        block ? "block w-full" : "min-w-[5.25rem]"
      }`}
    >
      {slot.time.toUpperCase()}
      {who && (
        <span className="block truncate text-[11px] font-normal leading-tight text-teal/80">
          {who.split(" ")[0]}
        </span>
      )}
    </button>
  );
}

/** Which office's times to show: both, or one — radio buttons, one per office. */
function OfficePicker() {
  const { officeId, setOfficeId } = useBooking();
  const { tr } = useLang();
  const choices: { id: OfficeChoice; name: string; area: string }[] = [
    { id: "any", name: tr.bothOffices, area: getOffices().map((office) => office.area).join(" · ") },
    ...getOffices().map((office) => ({ id: office.id, name: office.name, area: office.area })),
  ];
  return (
    <fieldset className="mt-6">
      <legend className="text-[17px] font-bold tracking-tight">{tr.chooseOffice}</legend>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        {choices.map((choice) => {
          const active = officeId === choice.id;
          return (
            <label
              key={choice.id}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition has-focus-visible:outline-2 has-focus-visible:outline-wine ${
                active ? "border-ink bg-cream-deep" : "border-line-strong bg-white hover:border-ink/40"
              }`}
            >
              <input
                type="radio"
                name="booking-office"
                value={choice.id}
                checked={active}
                onChange={() => setOfficeId(choice.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-wine"
              />
              <span className="min-w-0">
                <span className={`block text-[15px] ${active ? "font-semibold" : "font-medium"}`}>
                  {choice.name}
                </span>
                <span className="block text-[13px] text-ink-soft">{choice.area}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The provider chosen on their card — or the practice if none is. */
function ProviderHeader() {
  const { providerId } = useBooking();
  const provider = providerById(providerId === "any" ? null : providerId);
  if (provider) {
    return (
      <div className="flex items-center gap-4">
        <ProviderAvatar provider={provider} size="sm" />
        <div>
          <p className="text-[19px] font-bold leading-snug tracking-tight">{provider.name}</p>
          <p className="text-[16px] text-ink-soft">{provider.cred}</p>
          <p className="mt-0.5 text-[15px] text-ink-soft">{practice.name}</p>
        </div>
      </div>
    );
  }
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

function SummaryCard({ picked, reason }: { picked: Picked; reason?: string }) {
  const { lang } = useLang();
  const provider = providerById(picked.providerId);
  return (
    <div className="flex gap-3 rounded-xl border border-line-strong p-4">
      {provider ? (
        <ProviderAvatar provider={provider} size="sm" />
      ) : (
        <Image
          src="/logo.png"
          alt={practice.photoAlt}
          width={52}
          height={52}
          className="h-13 w-13 shrink-0 rounded-lg border border-line bg-white object-contain p-1"
        />
      )}
      <div className="text-[15px] leading-relaxed">
        <p className="text-[17px] font-bold tracking-tight">{provider?.name ?? practice.name}</p>
        <p className="text-ink-soft">{provider?.cred ?? practice.specialty}</p>
        <p className="font-medium">
          {shortDate(picked.iso, lang)} · {picked.time.toUpperCase()} {practice.timezone}
        </p>
        <p className="text-ink-soft">{addressFor(picked.officeId)}</p>
        {reason && <p className="text-ink-soft">{reasonLabel(reason, lang)}</p>}
      </div>
    </div>
  );
}

const FIELD =
  "focus-ring w-full rounded-lg border border-line-strong bg-white px-3.5 py-3 text-[16px] placeholder:text-muted";


/**
 * Zocdoc's "Scheduling details", asked once a time is chosen: the visit
 * reason from that provider's own list, insurance, and new or existing.
 */
function VisitStep({
  picked,
  onBack,
  onNext,
}: {
  picked: Picked;
  onBack: () => void;
  onNext: () => void;
}) {
  const {
    providerReasons,
    reason,
    setReason,
    insurance,
    insuranceChosen,
    openInsurance,
    patientType,
    setPatientType,
  } = useBooking();
  const { tr } = useLang();
  const [error, setError] = useState("");
  const options = (picked.providerId && providerReasons[picked.providerId]) || ALL_VISIT_REASONS;

  // Start on a reason this provider takes (a "Book again" may carry another).
  const valid = reasonFor(options, reason);
  useEffect(() => {
    if (valid !== reason) setReason(valid);
  }, [valid, reason, setReason]);

  function next(event: React.FormEvent) {
    event.preventDefault();
    if (!insuranceChosen) {
      setError(tr.chooseInsuranceFirst);
      return;
    }
    onNext();
  }

  return (
    <form onSubmit={next}>
      <SummaryCard picked={picked} />

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="visit-reason" className="mb-1.5 block text-[15px] font-semibold">
            {tr.reasonQuestion}
          </label>
          <VisitReasonSelect
            id="visit-reason"
            value={valid}
            onChange={setReason}
            options={options}
            withIcon
          />
        </div>

        <div>
          <p className="mb-1.5 text-[15px] font-semibold">{tr.insuranceQuestion}</p>
          <button
            type="button"
            onClick={() => {
              setError("");
              openInsurance();
            }}
            className={`focus-ring flex w-full items-center gap-2.5 rounded-lg border bg-white px-3.5 py-3 text-left text-[16px] transition hover:border-ink/40 ${
              error ? "border-wine" : "border-line-strong"
            }`}
          >
            <ShieldSmall className="h-5 w-5 shrink-0" />
            <span className={`truncate ${insuranceChosen ? "text-ink" : "text-ink-soft"}`}>
              {insurance
                ? `${insurance.carrier} · ${insurance.plan}`
                : insuranceChosen
                  ? tr.selfPay
                  : tr.insurancePlaceholder}
            </span>
          </button>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[15px] font-semibold">{tr.visitedBefore}</legend>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-line-strong">
            {(["new", "existing"] as const).map((type, index) => {
              const active = patientType === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPatientType(type)}
                  className={`focus-ring flex flex-col items-center justify-center px-3 py-2.5 text-center transition ${
                    index === 1 ? "border-l border-line-strong" : ""
                  } ${active ? "bg-cream-deep" : "bg-white hover:bg-cream"}`}
                >
                  <span
                    className={`flex items-center gap-1.5 text-[15px] ${active ? "font-semibold" : ""}`}
                  >
                    {active && <CheckIcon className="h-4 w-4" />}
                    {type === "new" ? tr.newPatient : tr.existingPatient}
                  </span>
                  <span className="text-[13px] text-ink-soft">
                    {type === "new" ? tr.newPatientHint : tr.existingPatientHint}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-wine-soft px-3 py-2 text-[15px] text-wine-deep">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="focus-ring mt-6 w-full rounded-lg bg-wine px-4 py-3.5 text-[17px] font-semibold text-white transition hover:bg-wine-deep"
      >
        {tr.continue}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="focus-ring mt-3 w-full text-[15px] font-medium link-underline"
      >
        {tr.changeTime}
      </button>
    </form>
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
  onBooked: (result: Result) => void;
  onSlotGone: () => void;
}) {
  const { user } = useSession();
  const { reschedule } = useBooking();
  const { lang, tr } = useLang();
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Guests prove their email with a code before the booking is saved.
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
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

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, purpose: "booking", lang }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? tr.sendCodeFailed);
        if (typeof data.retryInSeconds === "number") setCooldown(data.retryInSeconds);
        return;
      }
      setVerifying(true);
      setCooldown(45);
      setNotice(data.devCode ? tr.verifyDev(data.devCode) : tr.verifySent(form.email));
    } catch {
      setError(tr.serverDown);
    } finally {
      setBusy(false);
    }
  }

  async function book() {
    // Shared with the server event so Meta deduplicates the pair into one
    // conversion instead of counting the same booking twice.
    const eventId = newEventId();
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotId: picked.slotId,
        reason,
        patientType,
        insurance,
        patient: form,
        lang,
        eventId,
        // Moving an appointment: the server cancels the old one once this is booked.
        ...(reschedule ? { reschedule: reschedule.token } : {}),
      }),
    });
    const data = await response.json();

    if (response.status === 409) {
      setError(data.error ?? tr.slotTaken);
      setTimeout(onSlotGone, 1500);
      return;
    }
    if (response.status === 401 && data.needsVerification) {
      setVerifying(true);
      return;
    }
    if (!response.ok) {
      setError(data.error ?? tr.saveFailed);
      return;
    }

    // Only on a real 201 — never in the 409 branch above, where the slot was
    // lost and no appointment exists. The event carries no booking details.
    track("Schedule", eventId);
    onBooked({
      manageToken: data.manageToken,
      emailed: Boolean(data.emailed),
      email: form.email.trim().toLowerCase(),
      name: `${form.firstName} ${form.lastName}`.trim(),
      guest: !user,
      moved: typeof data.moved === "boolean" ? data.moved : null,
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (user) {
        await book();
      } else if (!verifying) {
        setBusy(false);
        await sendCode();
        return;
      } else {
        const check = await fetch("/api/auth/otp", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, code }),
        });
        if (!check.ok) {
          const data = await check.json();
          setError(data.error ?? tr.codeWrong);
          return;
        }
        await book();
      }
    } catch {
      setError(tr.serverDown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <SummaryCard picked={picked} reason={reason} />

      {!verifying ? (
        <>
          <h3 className="mt-6 text-[28px] font-bold leading-tight tracking-tight">{tr.aboutYou}</h3>
          <p className="mt-1.5 text-[16px] text-ink-soft">{tr.aboutYouSub}</p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[15px] font-semibold">{tr.email}</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                readOnly={Boolean(user)}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className={`${FIELD} ${user ? "bg-cream text-ink-soft" : ""}`}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
                  {tr.firstName}
                  <InfoIcon className="h-4 w-4 text-muted" />
                </span>
                <input
                  required
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                  className={FIELD}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
                  {tr.lastName}
                  <InfoIcon className="h-4 w-4 text-muted" />
                </span>
                <input
                  required
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                  className={FIELD}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[15px] font-semibold">{tr.dob}</span>
              <DateInput
                required
                autoComplete="bday"
                min="1900-01-01"
                max={new Date().toISOString().slice(0, 10)}
                value={form.dob}
                onChange={(event) => setForm({ ...form, dob: event.target.value })}
                className={FIELD}
              />
            </label>

            <fieldset>
              <legend className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold">
                {tr.sex}
                <InfoIcon className="h-4 w-4 text-muted" />
              </legend>
              <div className="space-y-2">
                {(["Male", "Female"] as const).map((option) => (
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
                    {option === "Male" ? tr.male : tr.female}
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
                {more ? tr.hideGender : tr.moreGender}
              </button>
              <span className="ml-1.5 text-[15px] text-muted">{tr.optional}</span>

              {more && (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[15px] font-semibold">{tr.genderIdentity}</span>
                    <input
                      value={form.genderIdentity}
                      onChange={(event) => setForm({ ...form, genderIdentity: event.target.value })}
                      className={FIELD}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[15px] font-semibold">{tr.pronouns}</span>
                    <input
                      value={form.pronouns}
                      onChange={(event) => setForm({ ...form, pronouns: event.target.value })}
                      className={FIELD}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <h3 className="mt-6 text-[26px] font-bold leading-tight tracking-tight">{tr.verifyTitle}</h3>
          {notice && (
            <p role="status" className="mt-2 rounded-lg bg-teal-soft px-3.5 py-2.5 text-[15px] text-teal">
              {notice}
            </p>
          )}
          <label className="mt-5 block">
            <span className="mb-1.5 block text-[15px] font-semibold">{tr.code}</span>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className={`${FIELD} text-center text-[22px] tracking-[0.4em]`}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[15px]">
            <button
              type="button"
              disabled={busy || cooldown > 0}
              onClick={sendCode}
              className="focus-ring font-medium link-underline disabled:text-muted disabled:no-underline"
            >
              {cooldown > 0 ? tr.resendIn(cooldown) : tr.resend}
            </button>
            <button
              type="button"
              onClick={() => {
                setVerifying(false);
                setCode("");
                setNotice("");
              }}
              className="focus-ring font-medium link-underline"
            >
              {tr.changeEmail}
            </button>
          </div>
        </>
      )}

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
        {busy
          ? verifying
            ? tr.verifying
            : user
              ? tr.booking
              : tr.sending
          : verifying
            ? tr.verifyAndBook
            : tr.continue}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="focus-ring mt-3 w-full text-[15px] font-medium link-underline"
      >
        {tr.backToDetails}
      </button>
    </form>
  );
}

function DoneStep({
  picked,
  reason,
  patientType,
  insurance,
  moved,
  result,
  onClose,
}: {
  picked: Picked;
  reason: string;
  patientType: string;
  insurance: string;
  moved: { label: string; ok: boolean } | null;
  result: Result | null;
  onClose: () => void;
}) {
  const { lang, tr } = useLang();
  const manage = result ? `/appointment/${result.manageToken}` : null;

  return (
    <div>
      <div className="flex flex-col items-center py-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft">
          <CheckIcon className="h-8 w-8 text-teal" />
        </span>
        <h3 className="mt-4 text-[24px] font-bold tracking-tight">
          {tr.youreBooked}
        </h3>
        <p className="mt-1.5 max-w-sm text-[15px] text-ink-soft">{tr.bookedNote(practice.name)}</p>
        {result?.emailed && (
          <p className="mt-1 max-w-sm text-[15px] text-ink-soft">{tr.emailSentNote(result.email)}</p>
        )}
      </div>

      {moved && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-3.5 py-2.5 text-[15px] ${
            moved.ok ? "bg-teal-soft text-teal" : "bg-wine-soft text-wine-deep"
          }`}
        >
          {moved.ok ? tr.movedOk(moved.label) : tr.movedFail(moved.label, practice.phone)}
        </p>
      )}

      <dl className="mt-5 space-y-2 rounded-xl bg-cream px-4 py-4 text-[15px]">
        <Row
          label={tr.when}
          value={`${longDate(picked.iso, lang)} · ${picked.time.toUpperCase()} ${practice.timezone}`}
        />
        {picked.providerId && (
          <Row label={tr.with} value={providerById(picked.providerId)?.name ?? ""} />
        )}
        <Row label={tr.visitReason} value={reasonLabel(reason, lang)} />
        <Row label={tr.patient} value={patientType === "new" ? tr.newPatient : tr.existingPatient} />
        <Row label={tr.insurance} value={insurance} />
        <Row label={tr.where} value={addressFor(picked.officeId)} />
      </dl>

      {manage && (
        <div className="mt-5 rounded-xl border border-teal/30 bg-teal-soft/60 p-4">
          <p className="text-[15px] font-semibold text-ink">{tr.checkInNow}</p>
          <p className="mt-0.5 text-[14px] text-ink-soft">{tr.checkInWhy}</p>
          <Link
            href={`${manage}/check-in`}
            className="focus-ring mt-3 inline-flex rounded-lg bg-teal px-4 py-2.5 text-[15px] font-semibold text-white transition hover:opacity-90"
          >
            {tr.checkInNow}
          </Link>
        </div>
      )}

      {result?.guest && <SaveAccount email={result.email} name={result.name} />}

      {manage && (
        <Link
          href={manage}
          className="focus-ring mt-5 block w-full rounded-lg bg-wine px-4 py-3.5 text-center text-[17px] font-semibold text-white transition hover:bg-wine-deep"
        >
          {tr.manageAppointment}
        </Link>
      )}
      {!result?.guest && (
        <Link
          href="/my-bookings"
          className="focus-ring mt-3 block w-full rounded-lg border border-line-strong px-4 py-3 text-center text-[16px] font-semibold transition hover:bg-cream"
        >
          {tr.seeMyBookings}
        </Link>
      )}
      <button
        type="button"
        onClick={onClose}
        className="focus-ring mt-3 w-full text-[15px] font-medium link-underline"
      >
        {tr.done}
      </button>
    </div>
  );
}

/**
 * Optional account for a guest who just booked. Their email was verified a
 * moment ago, which is all /api/auth/register needs — no second code.
 */
function SaveAccount({ email, name }: { email: string; name: string }) {
  const { tr } = useLang();
  const { setUser } = useSession();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "done" | "exists" | "error">("idle");
  const [error, setError] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Name and email come from the booking just made; only the password is new.
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, eventId: newEventId() }),
      });
      const data = await response.json();
      if (response.status === 409) {
        setState("exists");
        return;
      }
      if (!response.ok) {
        setError(data.error ?? "");
        setState("error");
        return;
      }
      setUser(data.user);
      setState("done");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="mt-5 rounded-xl bg-teal-soft px-4 py-3 text-[15px] text-teal">
        {tr.accountCreated}
      </p>
    );
  }
  if (state === "exists") {
    return (
      <p className="mt-5 rounded-xl border border-line-strong px-4 py-3 text-[15px] text-ink-soft">
        {tr.hasAccount}{" "}
        <Link href="/login?next=%2Fmy-bookings" className="font-semibold text-wine link-underline">
          {tr.logIn}
        </Link>
      </p>
    );
  }

  return (
    <form onSubmit={create} className="mt-5 rounded-xl border border-line-strong p-4">
      <p className="text-[15px] font-semibold">{tr.savePasswordTitle}</p>
      <p className="mt-0.5 text-[14px] text-ink-soft">{tr.savePasswordSub}</p>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-[14px] font-medium">{tr.password}</span>
        <PasswordInput
          required
          minLength={8}
          autoComplete="new-password"
          showLabel={tr.showPassword}
          hideLabel={tr.hidePassword}
          placeholder={tr.passwordHint}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={FIELD}
        />
      </label>
      {error && <p className="mt-2 text-[14px] text-wine-deep">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="focus-ring mt-3 rounded-lg border border-ink px-4 py-2.5 text-[15px] font-semibold transition hover:bg-ink hover:text-white disabled:opacity-60"
      >
        {tr.createAccount}
      </button>
    </form>
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
