"use client";

import { useMemo, useState } from "react";
import { practice } from "@/lib/practice";
import { addDays, buildWindow, formatLong, formatRange } from "@/lib/availability";
import { useBooking } from "./booking-context";
import VisitReasonSelect from "./VisitReasonSelect";
import { ChevronLeft, ChevronRight, CheckIcon, ShieldSmall } from "./icons";

const WINDOW = 14;

export default function BookingCard() {
  const {
    todayIso,
    reason,
    setReason,
    insurance,
    insuranceChosen,
    patientType,
    setPatientType,
    openInsurance,
    openBooking,
  } = useBooking();

  const [offset, setOffset] = useState(0);
  const startIso = addDays(todayIso, offset * WINDOW);
  const days = useMemo(
    () => buildWindow(startIso, todayIso, patientType, reason, WINDOW),
    [startIso, todayIso, patientType, reason],
  );

  return (
    <section
      aria-label="Book an appointment"
      className="rounded-card border border-line-strong bg-white p-6 shadow-[0_2px_0_rgba(18,16,12,0.04)] sm:p-7"
    >
      <h2 className="text-[26px] font-bold leading-tight tracking-tight">
        Book an appointment for free
      </h2>
      <p className="mt-1.5 text-[15px] text-teal">{practice.bookingPartner}</p>

      <h3 className="mt-6 text-[15px] font-semibold">Scheduling details</h3>

      <div className="mt-2.5 space-y-2.5">
        <VisitReasonSelect value={reason} onChange={setReason} />
        <button
          type="button"
          onClick={openInsurance}
          className="focus-ring flex w-full items-center gap-2.5 rounded-lg border border-line-strong bg-white px-3.5 py-3 text-left text-[15px] transition hover:border-ink/40"
        >
          <ShieldSmall className="h-5 w-5 shrink-0 text-ink" />
          <span className={`truncate ${insurance || insuranceChosen ? "text-ink" : "text-ink-soft"}`}>
            {insurance
              ? `${insurance.carrier} · ${insurance.plan}`
              : insuranceChosen
                ? "I'm paying for myself"
                : "Insurance carrier and plan"}
          </span>
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-2 overflow-hidden rounded-lg border border-line-strong">
        {(["new", "existing"] as const).map((type, index) => {
          const active = patientType === type;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => setPatientType(type)}
              className={`focus-ring flex items-center justify-center gap-2 px-4 py-3 text-[15px] transition ${
                index === 1 ? "border-l border-line-strong" : ""
              } ${active ? "bg-cream-deep font-semibold text-ink" : "bg-white text-ink hover:bg-cream"}`}
            >
              {active && <CheckIcon className="h-4 w-4" />}
              {type === "new" ? "New patient" : "Existing patient"}
            </button>
          );
        })}
      </div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold">
          {formatRange(startIso, addDays(startIso, WINDOW - 1))}
        </p>
        <div className="flex items-center gap-1">
          <ArrowButton
            label="Previous two weeks"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </ArrowButton>
          <ArrowButton
            label="Next two weeks"
            disabled={offset >= 12}
            onClick={() => setOffset((prev) => prev + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </ArrowButton>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const open = day.slots.length > 0;
          return (
            <button
              key={day.iso}
              type="button"
              disabled={!open}
              aria-label={`${formatLong(day.iso)} — ${
                open ? `${day.slots.length} appointments` : "no appointments"
              }`}
              onClick={() => openBooking(day.iso)}
              className={`flex min-h-[86px] flex-col gap-1 rounded-md px-2 py-2.5 text-left transition ${
                open
                  ? "bg-gold text-ink hover:bg-gold-deep"
                  : "cursor-default bg-cream-deep text-muted"
              }`}
            >
              <span className="text-[13px] leading-tight">{day.weekday}</span>
              <span className="text-[13px] font-medium leading-tight">{day.monthDay}</span>
              <span className="mt-auto text-[13px] leading-tight">
                {open ? `${day.slots.length} appt${day.slots.length > 1 ? "s" : ""}` : "No appts"}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => openBooking(null)}
        className="focus-ring mt-5 text-[15px] font-medium link-underline"
      >
        View more availability
      </button>
    </section>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="focus-ring flex h-9 w-9 items-center justify-center rounded-md text-ink transition hover:bg-cream-deep disabled:cursor-default disabled:text-line-strong disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
