import type { ObjectId } from "mongodb";
import type { IcoName } from "@/components/site/Ico";

export type AdminDoc = {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  lastLoginAt: Date | null;
};

/** Never carries passwordHash — this is what leaves the server. */
export type Admin = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export function serializeAdmin(doc: AdminDoc): Admin {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    createdAt: doc.createdAt?.toISOString() ?? "",
    lastLoginAt: doc.lastLoginAt?.toISOString() ?? null,
  };
}

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

export type Slot = Omit<SlotDoc, "_id" | "createdAt"> & { id: string; createdAt: string };

export type BookingStatus = "confirmed" | "cancelled";

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
  date: string;
  time: string;
  reason: string;
  patientType: "new" | "existing";
  insurance: { carrier: string; plan: string } | null;
  patient: Patient;
  status: BookingStatus;
  createdAt: Date;
};

export type Booking = Omit<BookingDoc, "_id" | "slotId" | "createdAt"> & {
  id: string;
  slotId: string;
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
  const { _id, createdAt, ...rest } = doc;
  return { id: _id.toString(), createdAt: createdAt?.toISOString() ?? "", ...rest };
}

export function serializeBooking(doc: BookingDoc): Booking {
  const { _id, slotId, createdAt, ...rest } = doc;
  return {
    id: _id.toString(),
    slotId: slotId?.toString() ?? "",
    createdAt: createdAt?.toISOString() ?? "",
    ...rest,
  };
}
