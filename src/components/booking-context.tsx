"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { defaultVisitReason } from "@/lib/practice";
import type { DayAvailability, PatientType } from "@/lib/availability";
import InsuranceModal from "./InsuranceModal";
import BookingFlowModal from "./BookingFlowModal";

export type Insurance = { carrier: string; plan: string } | null;

type BookingState = {
  todayIso: string;
  reason: string;
  setReason: (value: string) => void;
  insurance: Insurance;
  setInsurance: (value: Insurance) => void;
  insuranceChosen: boolean;
  patientType: PatientType;
  setPatientType: (value: PatientType) => void;
  openInsurance: () => void;
  openBooking: (iso?: string | null) => void;
  /** Fetches a window of real availability from the server. */
  loadAvailability: (startIso: string, days: number) => Promise<DayAvailability[]>;
  /** Bumped after a booking so open calendars refetch. */
  version: number;
  bumpVersion: () => void;
};

const BookingContext = createContext<BookingState | null>(null);

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside <BookingProvider>");
  return ctx;
}

/** Shared fetch + cache-free helper so both the card and the modal agree. */
export async function fetchAvailability(
  startIso: string,
  days: number,
): Promise<DayAvailability[]> {
  const response = await fetch(`/api/availability?start=${startIso}&days=${days}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load availability");
  const data = (await response.json()) as { days: DayAvailability[] };
  return data.days;
}

export function BookingProvider({
  todayIso,
  children,
}: {
  todayIso: string;
  children: React.ReactNode;
}) {
  const [reason, setReason] = useState<string>(defaultVisitReason);
  const [insurance, setInsuranceState] = useState<Insurance>(null);
  const [insuranceChosen, setInsuranceChosen] = useState(false);
  const [patientType, setPatientType] = useState<PatientType>("existing");
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const [bookingIso, setBookingIso] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [version, setVersion] = useState(0);

  // One lock so closing the stacked insurance modal doesn't unlock the page
  // while the booking modal is still open.
  useEffect(() => {
    if (!insuranceOpen && !bookingOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [insuranceOpen, bookingOpen]);

  const bumpVersion = useCallback(() => setVersion((prev) => prev + 1), []);

  const value = useMemo<BookingState>(
    () => ({
      todayIso,
      reason,
      setReason,
      insurance,
      setInsurance: (next: Insurance) => {
        setInsuranceState(next);
        setInsuranceChosen(true);
      },
      insuranceChosen,
      patientType,
      setPatientType,
      openInsurance: () => setInsuranceOpen(true),
      openBooking: (iso?: string | null) => {
        setBookingIso(iso ?? null);
        setBookingOpen(true);
      },
      loadAvailability: fetchAvailability,
      version,
      bumpVersion,
    }),
    [todayIso, reason, insurance, insuranceChosen, patientType, version, bumpVersion],
  );

  return (
    <BookingContext.Provider value={value}>
      {children}
      {bookingOpen && (
        <BookingFlowModal initialIso={bookingIso} onClose={() => setBookingOpen(false)} />
      )}
      {insuranceOpen && <InsuranceModal onClose={() => setInsuranceOpen(false)} />}
    </BookingContext.Provider>
  );
}
