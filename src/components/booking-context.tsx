"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { defaultVisitReason } from "@/lib/practice";
import type { DayAvailability, DaySlot, PatientType } from "@/lib/availability";
import type { OfficeId, ProviderId } from "@/lib/scheduling";
import InsuranceModal from "./InsuranceModal";
import BookingFlowModal from "./BookingFlowModal";

export type Insurance = { carrier: string; plan: string } | null;

/** "any" means the patient has not narrowed it down. */
export type OfficeChoice = OfficeId | "any";
export type ProviderChoice = ProviderId | "any";
export type SlotFilters = { officeId: OfficeChoice; providerId: ProviderChoice; reason?: string };

/** A time already chosen outside the modal, e.g. on a provider's card. */
export type PreselectedSlot = { iso: string; slot: DaySlot };

/** The appointment being moved, when /book was opened from "Reschedule". */
export type Reschedule = {
  token: string;
  label: string;
  /** Carried over from the visit being moved, so the patient doesn't re-enter them. */
  reason?: string;
  insurance?: Insurance;
  patientType?: PatientType;
} | null;

type BookingState = {
  todayIso: string;
  /** providerId -> the visit reasons their booking form offers. */
  providerReasons: Record<string, readonly string[]>;
  reason: string;
  setReason: (value: string) => void;
  insurance: Insurance;
  setInsurance: (value: Insurance) => void;
  insuranceChosen: boolean;
  patientType: PatientType;
  setPatientType: (value: PatientType) => void;
  officeId: OfficeChoice;
  setOfficeId: (value: OfficeChoice) => void;
  providerId: ProviderChoice;
  setProviderId: (value: ProviderChoice) => void;
  reschedule: Reschedule;
  clearReschedule: () => void;
  openInsurance: () => void;
  /** Opens the booking modal on a day — or straight at "about you" for a chosen time. */
  openBooking: (iso?: string | null, slot?: PreselectedSlot | null) => void;
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
  filters?: SlotFilters,
): Promise<DayAvailability[]> {
  const params = new URLSearchParams({ start: startIso, days: String(days) });
  if (filters && filters.officeId !== "any") params.set("office", filters.officeId);
  if (filters && filters.providerId !== "any") params.set("provider", filters.providerId);
  if (filters?.reason) params.set("reason", filters.reason);
  const response = await fetch(`/api/availability?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load availability");
  const data = (await response.json()) as { days: DayAvailability[] };
  return data.days;
}

export function BookingProvider({
  todayIso,
  providerReasons,
  initialOfficeId = "any",
  initialProviderId = "any",
  initialReschedule = null,
  children,
}: {
  todayIso: string;
  providerReasons: Record<string, readonly string[]>;
  /** Pre-selected from the link, e.g. "Book again" or "Reschedule". */
  initialOfficeId?: OfficeChoice;
  initialProviderId?: ProviderChoice;
  initialReschedule?: Reschedule;
  children: React.ReactNode;
}) {
  const [reason, setReason] = useState<string>(initialReschedule?.reason ?? defaultVisitReason);
  const [insurance, setInsuranceState] = useState<Insurance>(initialReschedule?.insurance ?? null);
  const [insuranceChosen, setInsuranceChosen] = useState(
    initialReschedule?.insurance !== undefined,
  );
  const [patientType, setPatientType] = useState<PatientType>(
    initialReschedule?.patientType ?? "existing",
  );
  const [officeId, setOfficeId] = useState<OfficeChoice>(initialOfficeId);
  const [providerId, setProviderId] = useState<ProviderChoice>(initialProviderId);
  const [reschedule, setReschedule] = useState<Reschedule>(initialReschedule);
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const [bookingIso, setBookingIso] = useState<string | null>(null);
  const [bookingSlot, setBookingSlot] = useState<PreselectedSlot | null>(null);
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
      providerReasons,
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
      officeId,
      setOfficeId,
      providerId,
      setProviderId,
      reschedule,
      clearReschedule: () => setReschedule(null),
      openInsurance: () => setInsuranceOpen(true),
      openBooking: (iso?: string | null, slot?: PreselectedSlot | null) => {
        setBookingIso(iso ?? null);
        setBookingSlot(slot ?? null);
        setBookingOpen(true);
      },
      loadAvailability: fetchAvailability,
      version,
      bumpVersion,
    }),
    [
      todayIso,
      providerReasons,
      reason,
      insurance,
      insuranceChosen,
      patientType,
      officeId,
      providerId,
      reschedule,
      version,
      bumpVersion,
    ],
  );

  return (
    <BookingContext.Provider value={value}>
      {children}
      {bookingOpen && (
        <BookingFlowModal
          initialIso={bookingIso}
          initialSlot={bookingSlot}
          onClose={() => setBookingOpen(false)}
        />
      )}
      {insuranceOpen && <InsuranceModal onClose={() => setInsuranceOpen(false)} />}
    </BookingContext.Provider>
  );
}
