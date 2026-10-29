import type { ObjectId } from "mongodb";
import type { IcoName } from "@/components/site/Ico";

/**
 * "admin" runs the whole back office. "provider" is a doctor: signs in on the
 * same page but only sees their own appointments (Admin → My appointments).
 */
export type StaffRole = "admin" | "provider";

export type AdminDoc = {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  /** Missing on accounts made before roles existed — those are admins. */
  role?: StaffRole;
  /** For a provider account: which provider (shah, denton, tate). */
  providerId?: string | null;
  /** Bumped on a password change: older sessions stop working. */
  sessionVersion?: number;
};

/** Never carries passwordHash — this is what leaves the server. */
export type Admin = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  role: StaffRole;
  providerId: string | null;
};

export function serializeAdmin(doc: AdminDoc): Admin {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    createdAt: doc.createdAt?.toISOString() ?? "",
    lastLoginAt: doc.lastLoginAt?.toISOString() ?? null,
    // Deny by default: "provider" stays a provider even if providerId is
    // missing (getCurrentAdmin then refuses it) — never a silent admin.
    role: doc.role === "provider" ? "provider" : "admin",
    providerId: doc.role === "provider" ? (doc.providerId ?? null) : null,
  };
}

export type UserDoc = {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  /** Bumped on a password change: older sessions stop working. */
  sessionVersion?: number;
};

/** Never carries passwordHash — this is what leaves the server. */
export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export function serializeUser(doc: UserDoc): User {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    createdAt: doc.createdAt?.toISOString() ?? "",
  };
}

export type EmailOtpDoc = {
  _id: ObjectId;
  email: string;
  /** HMAC of the 6-digit code — the code itself is never stored. */
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  sends: number;
  lastSentAt: Date;
  verifiedAt: Date | null;
};

export type PlanDoc = {
  _id: ObjectId;
  order: number;
  tag: string;
  tagIcon: IcoName;
  amount: string;
  title: string;
  body: string;
};

export type Plan = Omit<PlanDoc, "_id"> & { id: string };

export type SlotDoc = {
  _id: ObjectId;
  /** Who and where. Absent on slots created before scheduling by provider. */
  providerId?: string | null;
  officeId?: string | null;
  /** YYYY-MM-DD */
  date: string;
  /** "2:45 pm" — display form, also the sort key via `minutes` */
  time: string;
  minutes: number;
  capacity: number;
  booked: number;
  active: boolean;
  createdAt: Date;
};

export type Slot = Omit<SlotDoc, "_id" | "createdAt" | "providerId" | "officeId"> & {
  id: string;
  providerId: string | null;
  officeId: string | null;
  createdAt: string;
};

export type BookingStatus = "confirmed" | "cancelled";

/**
 * Pre-visit check-in. Photos live in GridFS (bucket "intake"); only their ids
 * are kept here. Every field is optional except the attestation.
 */
export type Intake = {
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  emergencyName: string;
  emergencyPhone: string;
  memberId: string;
  groupNumber: string;
  cardFrontId: string | null;
  cardBackId: string | null;
  photoIdId: string | null;
  allergies: string;
  medications: string;
  conditions: string;
  surgeries: string;
  lmp: string;
  pregnant: "" | "yes" | "no" | "not-sure";
  pregnancies: string;
  /** ISO timestamp of the latest submission. */
  submittedAt: string;
};

export type Patient = {
  email: string;
  firstName: string;
  lastName: string;
  dob: string;
  sex: string;
  genderIdentity?: string;
  pronouns?: string;
};

export type BookingDoc = {
  _id: ObjectId;
  slotId: ObjectId;
  /** Copied from the slot. Absent on bookings made before scheduling by provider. */
  providerId?: string | null;
  officeId?: string | null;
  /** Set when the patient was signed in; null for guest bookings. */
  userId?: ObjectId | null;
  date: string;
  time: string;
  reason: string;
  patientType: "new" | "existing";
  insurance: { carrier: string; plan: string } | null;
  patient: Patient;
  status: BookingStatus;
  /** Language for patient emails. Absent on older bookings (English). */
  lang?: "en" | "es";
  /** ISO timestamps of emails already sent, so cron runs never repeat one. */
  confirmationSentAt?: string | null;
  reminders?: { threeDay?: string; oneDay?: string };
  intake?: Intake | null;
  /** How the booking was made: signed-in account or verified-email guest. */
  via?: "account" | "guest" | "staff";
  createdAt: Date;
};

export type Booking = Omit<
  BookingDoc,
  "_id" | "slotId" | "userId" | "createdAt" | "providerId" | "officeId"
> & {
  id: string;
  slotId: string;
  providerId: string | null;
  officeId: string | null;
  userId: string | null;
  createdAt: string;
};

/** "2:45 pm" -> 885, so slots sort chronologically. */
export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(time.trim());
  if (!match) return 0;
  const [, h, m, suffix] = match;
  let hours = Number(h) % 12;
  if (suffix.toLowerCase() === "pm") hours += 12;
  return hours * 60 + Number(m);
}

export function minutesToTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "pm" : "am";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${`${m}`.padStart(2, "0")} ${suffix}`;
}

export function serializePlan(doc: PlanDoc): Plan {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

export function serializeSlot(doc: SlotDoc): Slot {
  const { _id, createdAt, providerId, officeId, ...rest } = doc;
  return {
    id: _id.toString(),
    providerId: providerId ?? null,
    officeId: officeId ?? null,
    createdAt: createdAt?.toISOString() ?? "",
    ...rest,
  };
}

/**
 * A booking as the patient's own panel and API get it: the check-in answers
 * (address, insurance ids, medical history, photo ids) are left out — the
 * panel only needs to know *whether* check-in was done. The full intake is
 * only shown on the check-in page itself and to staff.
 */
export function patientView(booking: Booking): Booking {
  const { intake, ...rest } = booking;
  return {
    ...rest,
    // Only submittedAt is set; the other Intake fields are deliberately absent.
    intake: intake ? ({ submittedAt: intake.submittedAt } as Intake) : null,
  };
}

export function serializeBooking(doc: BookingDoc): Booking {
  const { _id, slotId, userId, createdAt, providerId, officeId, ...rest } = doc;
  return {
    id: _id.toString(),
    slotId: slotId?.toString() ?? "",
    providerId: providerId ?? null,
    officeId: officeId ?? null,
    userId: userId?.toString() ?? null,
    createdAt: createdAt?.toISOString() ?? "",
    ...rest,
  };
}
