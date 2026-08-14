"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { defaultVisitReason } from "@/lib/practice";
import type { PatientType } from "@/lib/availability";
import InsuranceModal from "./InsuranceModal";
import BookingFlowModal from "./BookingFlowModal";

export type Insurance = { carrier: string; plan: string } | null;

type BookingState = {
  todayIso: string;
  reason: string;
  setReason: (value: string) => void;
  insurance: Insurance;
  setInsurance: (value: Insurance) => void;
  /** null = "I'm paying for myself" was chosen, undefined-ish = untouched */
  insuranceChosen: boolean;
  patientType: PatientType;
  setPatientType: (value: PatientType) => void;
  openInsurance: () => void;
  openBooking: (iso?: string | null) => void;
};

const BookingContext = createContext<BookingState | null>(null);

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside <BookingProvider>");
  return ctx;
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

  // A single lock so closing the stacked insurance modal doesn't unlock the page
  // while the booking modal is still open.
  useEffect(() => {
    if (!insuranceOpen && !bookingOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [insuranceOpen, bookingOpen]);

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
    }),
    [todayIso, reason, insurance, insuranceChosen, patientType],
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
