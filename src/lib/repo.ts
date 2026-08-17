import { ObjectId, type Filter } from "mongodb";
import { ensureIndexes, getDb } from "./db";
import { hashPassword, verifyPassword } from "./password";
import {
  minutesToTime,
  serializeAdmin,
  serializeBooking,
  serializePlan,
  serializeSlot,
  timeToMinutes,
  type Booking,
  type BookingDoc,
  type BookingStatus,
  type Patient,
  type Plan,
  type PlanDoc,
  serializeUser,
  type Admin,
  type AdminDoc,
  type Slot,
  type SlotDoc,
  type User,
  type UserDoc,
} from "./models";
import { addDays, fromIso, toIso } from "./availability";
import { prices } from "./site";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type DayAvailability = {
  iso: string;
  weekday: string;
  monthDay: string;
  slots: { id: string; time: string }[];
};

async function collections() {
  await ensureIndexes();
  const db = await getDb();
  return {
    admins: db.collection<AdminDoc>("admins"),
    users: db.collection<UserDoc>("users"),
    plans: db.collection<PlanDoc>("plans"),
    slots: db.collection<SlotDoc>("slots"),
    bookings: db.collection<BookingDoc>("bookings"),
  };
}

/* ---------------------------------------------------------------- users -- */

export class DuplicateUserError extends Error {
  constructor() {
    super("An account with that email already exists");
    this.name = "DuplicateUserError";
  }
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<User> {
  const { users } = await collections();
  const email = input.email.trim().toLowerCase();

  if (await users.findOne({ email })) throw new DuplicateUserError();

  const doc: UserDoc = {
    _id: new ObjectId(),
    name: input.name.trim(),
    email,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  try {
    await users.insertOne(doc);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new DuplicateUserError();
    throw error;
  }

  // Adopt any bookings this person made as a guest with the same email.
  await linkGuestBookings(doc._id, email);
  return serializeUser(doc);
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const { users } = await collections();
  const doc = await users.findOne({ email: email.trim().toLowerCase() });

  // Hash anyway when the email is unknown, so both failures take the same time.
  if (!doc) {
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
    return null;
  }
  if (!(await verifyPassword(password, doc.passwordHash))) return null;

  await users.updateOne({ _id: doc._id }, { $set: { lastLoginAt: new Date() } });
  await linkGuestBookings(doc._id, doc.email);
  return serializeUser(doc);
}

export async function getUserById(id: string): Promise<User | null> {
  const { users } = await collections();
  if (!ObjectId.isValid(id)) return null;
  const doc = await users.findOne({ _id: new ObjectId(id) });
  return doc ? serializeUser(doc) : null;
}

/** Attaches bookings made while signed out to the account with that email. */
async function linkGuestBookings(userId: ObjectId, email: string): Promise<void> {
  const { bookings } = await collections();
  await bookings.updateMany(
    { "patient.email": email, $or: [{ userId: null }, { userId: { $exists: false } }] },
    { $set: { userId } },
  );
}

export async function listUserBookings(userId: string, email: string): Promise<Booking[]> {
  const { bookings } = await collections();
  const docs = await bookings
    .find({ $or: [{ userId: new ObjectId(userId) }, { "patient.email": email }] })
    .sort({ date: -1, time: -1 })
    .limit(200)
    .toArray();
  return docs.map(serializeBooking);
}

/** Cancels a booking only if it belongs to this user. Frees the slot. */
export async function cancelUserBooking(
  bookingId: string,
  userId: string,
  email: string,
): Promise<Booking | null> {
  const { slots, bookings } = await collections();
  if (!ObjectId.isValid(bookingId)) return null;

  const doc = await bookings.findOne({
    _id: new ObjectId(bookingId),
    $or: [{ userId: new ObjectId(userId) }, { "patient.email": email }],
  });
  if (!doc) return null;
  if (doc.status === "cancelled") return serializeBooking(doc);

  const updated = await bookings.findOneAndUpdate(
    { _id: doc._id },
    { $set: { status: "cancelled" } },
    { returnDocument: "after" },
  );
  if (!updated) return null;

  await slots.updateOne({ _id: doc.slotId }, { $inc: { booked: -1 } });
  return serializeBooking(updated);
}

/* --------------------------------------------------------------- admins -- */

export class DuplicateAdminError extends Error {
  constructor() {
    super("An admin with that email already exists");
    this.name = "DuplicateAdminError";
  }
}

export async function countAdmins(): Promise<number> {
  const { admins } = await collections();
  return admins.countDocuments();
}

export async function listAdmins(): Promise<Admin[]> {
  const { admins } = await collections();
  const docs = await admins.find().sort({ createdAt: 1 }).toArray();
  return docs.map(serializeAdmin);
}

export async function createAdmin(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<Admin> {
  const { admins } = await collections();
  const email = input.email.trim().toLowerCase();

  if (await admins.findOne({ email })) throw new DuplicateAdminError();

  const doc: AdminDoc = {
    _id: new ObjectId(),
    email,
    name: input.name?.trim() || email.split("@")[0],
    passwordHash: await hashPassword(input.password),
    createdAt: new Date(),
    lastLoginAt: null,
  };

  try {
    await admins.insertOne(doc);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new DuplicateAdminError();
    throw error;
  }
  return serializeAdmin(doc);
}

/** Checks the password against the stored hash and stamps the login. */
export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<Admin | null> {
  const { admins } = await collections();
  const doc = await admins.findOne({ email: email.trim().toLowerCase() });

  // Hash anyway when the email is unknown, so a missing account and a wrong
  // password take the same amount of time.
  if (!doc) {
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
    return null;
  }
  if (!(await verifyPassword(password, doc.passwordHash))) return null;

  await admins.updateOne({ _id: doc._id }, { $set: { lastLoginAt: new Date() } });
  return serializeAdmin(doc);
}

export async function getAdminById(id: string): Promise<Admin | null> {
  const { admins } = await collections();
  if (!ObjectId.isValid(id)) return null;
  const doc = await admins.findOne({ _id: new ObjectId(id) });
  return doc ? serializeAdmin(doc) : null;
}

export async function updateAdmin(
  id: string,
  patch: { name?: string; password?: string },
): Promise<Admin | null> {
  const { admins } = await collections();
  const set: Partial<AdminDoc> = {};
  if (patch.name?.trim()) set.name = patch.name.trim();
  if (patch.password) set.passwordHash = await hashPassword(patch.password);
  if (Object.keys(set).length === 0) return getAdminById(id);

  const doc = await admins.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: set },
    { returnDocument: "after" },
  );
  return doc ? serializeAdmin(doc) : null;
}

export class LastAdminError extends Error {
  constructor() {
    super("You can't delete the only admin account");
    this.name = "LastAdminError";
  }
}

export async function deleteAdmin(id: string): Promise<boolean> {
  const { admins } = await collections();
  if ((await admins.countDocuments()) <= 1) throw new LastAdminError();
  const result = await admins.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

/* ---------------------------------------------------------------- plans -- */

export async function getPlans(): Promise<Plan[]> {
  const { plans } = await collections();
  const count = await plans.countDocuments();

  if (count === 0) {
    // First run — seed from the copy that used to be hard-coded on /pricing.
    await plans.insertMany(
      prices.map((price, index) => ({
        _id: new ObjectId(),
        order: index,
        tag: price.tag,
        tagIcon: price.tagIcon,
        amount: price.amount,
        title: price.title,
        body: price.body,
      })),
    );
  }

  const docs = await plans.find().sort({ order: 1 }).toArray();
  return docs.map(serializePlan);
}

export async function updatePlan(
  id: string,
  patch: Partial<Omit<Plan, "id">>,
): Promise<Plan | null> {
  const { plans } = await collections();
  const doc = await plans.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: patch },
    { returnDocument: "after" },
  );
  return doc ? serializePlan(doc) : null;
}

export async function createPlan(plan: Omit<Plan, "id">): Promise<Plan> {
  const { plans } = await collections();
  const _id = new ObjectId();
  await plans.insertOne({ _id, ...plan });
  return serializePlan({ _id, ...plan });
}

export async function deletePlan(id: string): Promise<boolean> {
  const { plans } = await collections();
  const result = await plans.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

/* ---------------------------------------------------------------- slots -- */

export async function listSlots(from: string, to: string): Promise<Slot[]> {
  const { slots } = await collections();
  const docs = await slots
    .find({ date: { $gte: from, $lte: to } })
    .sort({ date: 1, minutes: 1 })
    .toArray();
  return docs.map(serializeSlot);
}

export type SlotInput = {
  dates: string[];
  times: string[];
  capacity?: number;
};

/** Adds every (date × time) pair, skipping ones that already exist. */
export async function createSlots(input: SlotInput): Promise<{ added: number; skipped: number }> {
  const { slots } = await collections();
  const capacity = Math.max(1, input.capacity ?? 1);
  const docs: SlotDoc[] = [];

  for (const date of input.dates) {
    for (const time of input.times) {
      const minutes = timeToMinutes(time);
      docs.push({
        _id: new ObjectId(),
        date,
        time: minutesToTime(minutes),
        minutes,
        capacity,
        booked: 0,
        active: true,
        createdAt: new Date(),
      });
    }
  }

  if (docs.length === 0) return { added: 0, skipped: 0 };

  try {
    const result = await slots.insertMany(docs, { ordered: false });
    return { added: result.insertedCount, skipped: docs.length - result.insertedCount };
  } catch (error) {
    // Duplicate (date, time) pairs are expected — count what did land.
    const written = (error as { result?: { insertedCount?: number } })?.result?.insertedCount ?? 0;
    return { added: written, skipped: docs.length - written };
  }
}

export async function setSlotActive(id: string, active: boolean): Promise<Slot | null> {
  const { slots } = await collections();
  const doc = await slots.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { active } },
    { returnDocument: "after" },
  );
  return doc ? serializeSlot(doc) : null;
}

export async function deleteSlot(id: string): Promise<boolean> {
  const { slots } = await collections();
  const result = await slots.deleteOne({ _id: new ObjectId(id), booked: 0 });
  return result.deletedCount === 1;
}

/* --------------------------------------------------------- availability -- */

export async function getAvailability(startIso: string, days: number): Promise<DayAvailability[]> {
  const { slots } = await collections();
  const todayIso = toIso(new Date());
  const from = startIso < todayIso ? todayIso : startIso;
  const to = addDays(startIso, days - 1);

  const docs = await slots
    .find({ date: { $gte: from, $lte: to }, active: true, $expr: { $lt: ["$booked", "$capacity"] } })
    .sort({ date: 1, minutes: 1 })
    .toArray();

  const byDate = new Map<string, { id: string; time: string }[]>();
  for (const doc of docs) {
    byDate.set(doc.date, [
      ...(byDate.get(doc.date) ?? []),
      { id: doc._id.toString(), time: doc.time },
    ]);
  }

  return Array.from({ length: days }, (_, index) => {
    const iso = addDays(startIso, index);
    const date = fromIso(iso);
    return {
      iso,
      weekday: WEEKDAYS[date.getUTCDay()],
      monthDay: `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`,
      slots: byDate.get(iso) ?? [],
    };
  });
}

/* ------------------------------------------------------------- bookings -- */

export type NewBooking = {
  slotId: string;
  userId?: string | null;
  reason: string;
  patientType: "new" | "existing";
  insurance: { carrier: string; plan: string } | null;
  patient: Patient;
};

export class SlotUnavailableError extends Error {
  constructor() {
    super("That time was just taken. Pick another one.");
    this.name = "SlotUnavailableError";
  }
}

export async function createBooking(input: NewBooking): Promise<Booking> {
  const { slots, bookings } = await collections();

  // Claim the seat first: the conditional update is the atomic guard against
  // two people booking the last opening at the same moment.
  const slot = await slots.findOneAndUpdate(
    {
      _id: new ObjectId(input.slotId),
      active: true,
      $expr: { $lt: ["$booked", "$capacity"] },
    },
    { $inc: { booked: 1 } },
    { returnDocument: "after" },
  );

  if (!slot) throw new SlotUnavailableError();

  const doc: BookingDoc = {
    _id: new ObjectId(),
    slotId: slot._id,
    userId: input.userId && ObjectId.isValid(input.userId) ? new ObjectId(input.userId) : null,
    date: slot.date,
    time: slot.time,
    reason: input.reason,
    patientType: input.patientType,
    insurance: input.insurance,
    patient: input.patient,
    status: "confirmed",
    createdAt: new Date(),
  };

  try {
    await bookings.insertOne(doc);
  } catch (error) {
    await slots.updateOne({ _id: slot._id }, { $inc: { booked: -1 } });
    throw error;
  }

  return serializeBooking(doc);
}

export async function listBookings(status?: BookingStatus): Promise<Booking[]> {
  const { bookings } = await collections();
  const filter: Filter<BookingDoc> = status ? { status } : {};
  const docs = await bookings.find(filter).sort({ createdAt: -1 }).limit(500).toArray();
  return docs.map(serializeBooking);
}

export async function setBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<Booking | null> {
  const { slots, bookings } = await collections();
  const existing = await bookings.findOne({ _id: new ObjectId(id) });
  if (!existing || existing.status === status) {
    return existing ? serializeBooking(existing) : null;
  }

  const doc = await bookings.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status } },
    { returnDocument: "after" },
  );
  if (!doc) return null;

  // Cancelling frees the seat; un-cancelling takes it back.
  await slots.updateOne(
    { _id: doc.slotId },
    { $inc: { booked: status === "cancelled" ? -1 : 1 } },
  );

  return serializeBooking(doc);
}

export async function deleteBooking(id: string): Promise<boolean> {
  const { slots, bookings } = await collections();
  const doc = await bookings.findOne({ _id: new ObjectId(id) });
  if (!doc) return false;

  await bookings.deleteOne({ _id: doc._id });
  if (doc.status === "confirmed") {
    await slots.updateOne({ _id: doc.slotId }, { $inc: { booked: -1 } });
  }
  return true;
}

/* ------------------------------------------------------------ dashboard -- */

export type Stats = {
  bookingsTotal: number;
  bookingsUpcoming: number;
  bookingsCancelled: number;
  slotsOpen: number;
  slotsTotal: number;
  plans: number;
  recent: Booking[];
};

export async function getStats(): Promise<Stats> {
  const { slots, bookings, plans } = await collections();
  const todayIso = toIso(new Date());

  const [bookingsTotal, bookingsUpcoming, bookingsCancelled, slotsOpen, slotsTotal, planCount, recent] =
    await Promise.all([
      bookings.countDocuments(),
      bookings.countDocuments({ status: "confirmed", date: { $gte: todayIso } }),
      bookings.countDocuments({ status: "cancelled" }),
      slots.countDocuments({
        active: true,
        date: { $gte: todayIso },
        $expr: { $lt: ["$booked", "$capacity"] },
      }),
      slots.countDocuments({ date: { $gte: todayIso } }),
      plans.countDocuments(),
      bookings.find().sort({ createdAt: -1 }).limit(6).toArray(),
    ]);

  return {
    bookingsTotal,
    bookingsUpcoming,
    bookingsCancelled,
    slotsOpen,
    slotsTotal,
    plans: planCount,
    recent: recent.map(serializeBooking),
  };
}
