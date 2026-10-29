import { GridFSBucket, ObjectId, type Filter } from "mongodb";
import { ensureIndexes, getDb } from "./db";
import { deletePhoto } from "./intake-files";
import { DUMMY_HASH, hashPassword, needsRehash, verifyPassword } from "./password";
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
  type Intake,
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
import {
  addDays,
  fromIso,
  toIso,
  type DayAvailability,
  type DaySlot,
} from "./availability";
import {
  arizonaMinutesNow,
  arizonaTodayIso,
  cleanSchedule,
  DEFAULT_WEEKLY_SCHEDULE,
  hoursFromSchedule,
  type OfficeHours,
  isOfficeId,
  isProviderId,
  mondayOf,
  providerIds,
  type OfficeId,
  type ProviderId,
  type ScheduleRow,
} from "./scheduling";
import { bookingIdFromToken, manageLinkExpired } from "./booking-links";
import { ALL_VISIT_REASONS, visitReasons, zocdocReasons } from "./practice";
import {
  AVATAR_COLORS,
  ctaFor,
  DEFAULT_PROVIDERS,
  getAllProviders,
  initialsOf,
  markProvidersLoaded,
  providersLoadedAt,
  setProviders,
  type Provider,
} from "./providers";
import { photos, type PhotoKey } from "./photos";
import { prices } from "./site";
import {
  DEFAULT_SITE_CONTENT,
  getSiteContent,
  markSiteContentLoaded,
  OFFICE_IDS,
  setSiteContent,
  siteContentLoadedAt,
  type ImageRef,
  type SiteContent,
} from "./site-content";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

async function collections() {
  await ensureIndexes();
  // Most reads need provider names or ids (lib/providers keeps them in memory).
  await loadProviders();
  // …and office names and addresses (Admin → Site content).
  await loadSiteContent().catch(() => undefined);
  const db = await getDb();
  return {
    admins: db.collection<AdminDoc>("admins"),
    users: db.collection<UserDoc>("users"),
    plans: db.collection<PlanDoc>("plans"),
    slots: db.collection<SlotDoc>("slots"),
    bookings: db.collection<BookingDoc>("bookings"),
  };
}

/* ------------------------------------------------------------ providers -- */

type ProviderDoc = Omit<Provider, "id"> & { _id: string; updatedAt?: Date };

const PROVIDERS_TTL_MS = 30_000;
let providersLoading: Promise<Provider[]> | null = null;

function toProvider({ _id, updatedAt: _ignored, ...rest }: ProviderDoc): Provider {
  void _ignored;
  return { id: _id, ...rest, zocdocCheckedAt: rest.zocdocCheckedAt ?? null };
}

/**
 * Reads the providers from MongoDB into lib/providers (filling an empty
 * collection from the seed list first) and returns them. Cached for 30 s per
 * server, so a change from Admin → Doctors reaches every server within that.
 */
export async function loadProviders(force = false): Promise<Provider[]> {
  if (!force && Date.now() - providersLoadedAt() < PROVIDERS_TTL_MS) return getAllProviders();
  if (providersLoading && !force) return providersLoading;
  providersLoading = (async () => {
    const db = await getDb();
    const collection = db.collection<ProviderDoc>("providers");
    let docs = await collection.find().sort({ order: 1 }).toArray();
    // Seed providers not in the collection yet (all of them on a fresh
    // database; later additions to seedProviders on an existing one). Only
    // ever inserts — an admin's edits are never overwritten.
    const have = new Set(docs.map((doc) => doc._id));
    const missing = DEFAULT_PROVIDERS.filter((provider) => !have.has(provider.id));
    if (missing.length) {
      const after = docs.reduce((max, doc) => Math.max(max, doc.order ?? 0), -1) + 1;
      await collection
        .bulkWrite(
          missing.map(({ id, ...rest }, i) => ({
            updateOne: {
              filter: { _id: id },
              update: { $setOnInsert: { ...rest, order: docs.length ? after + i : rest.order, updatedAt: new Date() } },
              upsert: true,
            },
          })),
          { ordered: false },
        )
        .catch(() => undefined);
      docs = await collection.find().sort({ order: 1 }).toArray();
    }
    const list = docs.map(toProvider);
    setProviders(list);
    markProvidersLoaded(Date.now());
    return getAllProviders();
  })().finally(() => {
    providersLoading = null;
  });
  return providersLoading;
}

export class ProviderInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderInputError";
  }
}

const URL_RE = /^https:\/\/[^\s]+$/i;

function cleanLines(value: unknown, maxItems: number, maxLength: number): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : [];
  return raw
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanUrl(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !URL_RE.test(value.trim()) || value.length > 300) {
    throw new ProviderInputError(`${field} must be a full https:// link`);
  }
  return value.trim();
}

/** Validates and normalises a profile coming from Admin → Doctors. */
export function cleanProviderInput(
  input: Record<string, unknown>,
): Omit<Provider, "id" | "order" | "photo" | "photoUrl" | "zocdocCheckedAt"> {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
  if (name.length < 3) throw new ProviderInputError("Enter the provider's full name");
  const cred = typeof input.cred === "string" ? input.cred.trim().slice(0, 80) : "";
  if (!cred) throw new ProviderInputError("Enter a title, e.g. Nurse Practitioner (OB-GYN)");
  const languages = cleanLines(
    typeof input.languages === "string" ? input.languages.split(",") : input.languages,
    10,
    30,
  );
  if (languages.length === 0) throw new ProviderInputError("Add at least one language");
  const rating = input.zocdocRating === "" || input.zocdocRating === null || input.zocdocRating === undefined
    ? null
    : Number(input.zocdocRating);
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
    throw new ProviderInputError("Zocdoc rating must be between 0 and 5");
  }
  const reviews = input.zocdocReviews === "" || input.zocdocReviews === null || input.zocdocReviews === undefined
    ? null
    : Number(input.zocdocReviews);
  if (reviews !== null && (!Number.isInteger(reviews) || reviews < 0 || reviews > 100000)) {
    throw new ProviderInputError("Zocdoc reviews must be a whole number");
  }
  const npi = typeof input.npi === "string" ? input.npi.trim() : "";
  if (npi && !/^\d{10}$/.test(npi)) throw new ProviderInputError("An NPI is 10 digits");
  const avatar = AVATAR_COLORS.includes(input.avatar as (typeof AVATAR_COLORS)[number])
    ? (input.avatar as string)
    : AVATAR_COLORS[0];
  const cta = typeof input.cta === "string" && input.cta.trim() ? input.cta.trim().slice(0, 40) : ctaFor(name);
  return {
    name,
    cred,
    initials: initialsOf(name),
    languages,
    avatar,
    zocdocRating: rating,
    zocdocReviews: reviews,
    zocdocUrl: cleanUrl(input.zocdocUrl, "Zocdoc link"),
    ecwUrl: cleanUrl(input.ecwUrl, "eCW link"),
    npi,
    about: cleanLines(input.about, 6, 1200),
    education: cleanLines(input.education, 8, 200),
    certifications: cleanLines(input.certifications, 8, 200),
    focus: cleanLines(input.focus, 12, 80),
    cta,
    active: input.active !== false,
  };
}

/** A URL-safe id from a name: "Dr. Maria Lopez, MD" → "lopez" (or "lopez-2" if taken). */
function providerIdFor(name: string, taken: string[]): string {
  const plain = name.replace(/^dr\.?\s+/i, "").split(",")[0].trim().toLowerCase();
  const parts = plain.normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const base = (parts[parts.length - 1] ?? "provider").slice(0, 20) || "provider";
  let id = base;
  for (let n = 2; taken.includes(id); n += 1) id = `${base}-${n}`;
  return id;
}

export async function createProvider(input: Record<string, unknown>): Promise<Provider> {
  const clean = cleanProviderInput(input);
  const all = await loadProviders(true);
  const db = await getDb();
  const id = providerIdFor(clean.name, all.map((provider) => provider.id));
  const doc: ProviderDoc = {
    _id: id,
    ...clean,
    photo: null,
    photoUrl: null,
    zocdocCheckedAt: clean.zocdocUrl ? arizonaTodayIso() : null,
    order: Math.max(-1, ...all.map((provider) => provider.order)) + 1,
    updatedAt: new Date(),
  };
  await db.collection<ProviderDoc>("providers").insertOne(doc);
  await loadProviders(true);
  return toProvider(doc);
}

export async function updateProvider(id: string, input: Record<string, unknown>): Promise<Provider | null> {
  const clean = cleanProviderInput(input);
  const db = await getDb();
  const collection = db.collection<ProviderDoc>("providers");
  const before = await collection.findOne({ _id: id });
  if (!before) return null;
  // New Zocdoc numbers, or "I checked Zocdoc today", restart the 30-day clock.
  const numbersChanged =
    before.zocdocRating !== clean.zocdocRating ||
    before.zocdocReviews !== clean.zocdocReviews ||
    before.zocdocUrl !== clean.zocdocUrl;
  const checked = input.zocdocCheckedNow === true || numbersChanged;
  const doc = await collection.findOneAndUpdate(
    { _id: id },
    { $set: { ...clean, ...(checked ? { zocdocCheckedAt: arizonaTodayIso() } : {}), updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  await loadProviders(true);
  return doc ? toProvider(doc) : null;
}

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Stores a new headshot (≤ 4 MB JPEG/PNG/WebP) and points the provider at it. */
export async function setProviderPhoto(id: string, file: File): Promise<Provider | null> {
  if (!PHOTO_TYPES.has(file.type)) throw new ProviderInputError("Use a JPEG, PNG or WebP photo");
  if (file.size > 4 * 1024 * 1024) throw new ProviderInputError("That photo is too large (4 MB max)");
  const data = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(data)) throw new ProviderInputError("That file isn't a photo");

  const db = await getDb();
  const collection = db.collection<ProviderDoc>("providers");
  const existing = await collection.findOne({ _id: id });
  if (!existing) return null;

  const bucket = new GridFSBucket(db, { bucketName: "provider_photos" });
  const fileId = new ObjectId();
  await new Promise<void>((resolve, reject) => {
    const upload = bucket.openUploadStreamWithId(fileId, `${id}-photo`, { metadata: { providerId: id, contentType: file.type } });
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(data);
  });
  // The old upload goes once the new one is in place.
  const old = existing.photoUrl?.match(/\/api\/provider-photos\/([a-f\d]{24})$/)?.[1];
  if (old) await bucket.delete(new ObjectId(old)).catch(() => undefined);

  const doc = await collection.findOneAndUpdate(
    { _id: id },
    { $set: { photoUrl: `/api/provider-photos/${fileId.toString()}`, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  await loadProviders(true);
  return doc ? toProvider(doc) : null;
}

/** A provider headshot, public (it is on the website anyway). */
export async function readProviderPhoto(fileId: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!ObjectId.isValid(fileId)) return null;
  const db = await getDb();
  const bucket = new GridFSBucket(db, { bucketName: "provider_photos" });
  const [file] = await bucket.find({ _id: new ObjectId(fileId) }).limit(1).toArray();
  if (!file) return null;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    bucket
      .openDownloadStream(file._id)
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("end", () => resolve())
      .on("error", reject);
  });
  const contentType = (file.metadata as { contentType?: string } | undefined)?.contentType ?? "image/jpeg";
  return { data: Buffer.concat(chunks), contentType };
}

/* ------------------------------------------------- staff sign-ins (logins) -- */

/** Every staff account with its role, for Settings and Doctors. */
export async function listStaff(): Promise<Admin[]> {
  const { admins } = await collections();
  const docs = await admins.find().sort({ createdAt: 1 }).toArray();
  return docs.map(serializeAdmin);
}

export class StaffInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffInputError";
  }
}

const STAFF_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function staffPassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    throw new StaffInputError("Use a password of at least 12 characters");
  }
  return password;
}

/**
 * Creates or updates the sign-in a provider uses for their own panel. A new
 * password signs that doctor out everywhere (session version).
 */
export async function setProviderLogin(
  providerId: string,
  input: { email?: unknown; password?: unknown },
): Promise<Admin> {
  if (!isProviderId(providerId)) throw new StaffInputError("Unknown provider");
  const { admins } = await collections();
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 120) : "";
  if (!STAFF_EMAIL.test(email)) throw new StaffInputError("Enter a valid email for the sign-in");

  const current = await admins.findOne({ role: "provider", providerId });
  const owner = await admins.findOne({ email });
  if (owner && (!current || !owner._id.equals(current._id))) {
    throw new StaffInputError("Another staff account already uses that email");
  }
  const name = getAllProviders().find((provider) => provider.id === providerId)?.name ?? email;

  if (!current) {
    const password = staffPassword(input.password);
    const doc: AdminDoc = {
      _id: new ObjectId(),
      email,
      name,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
      lastLoginAt: null,
      role: "provider",
      providerId,
    };
    await admins.insertOne(doc);
    return serializeAdmin(doc);
  }

  const set: Partial<AdminDoc> = { email, name };
  const hasPassword = typeof input.password === "string" && input.password.length > 0;
  if (hasPassword) set.passwordHash = await hashPassword(staffPassword(input.password));
  const doc = await admins.findOneAndUpdate(
    { _id: current._id },
    { $set: set, ...(hasPassword || email !== current.email ? { $inc: { sessionVersion: 1 } } : {}) },
    { returnDocument: "after" },
  );
  return serializeAdmin(doc!);
}

/** Removes a provider's sign-in. Their profile and bookings stay. */
export async function removeProviderLogin(providerId: string): Promise<boolean> {
  const { admins } = await collections();
  const result = await admins.deleteOne({ role: "provider", providerId });
  return result.deletedCount === 1;
}

/** An admin changes their own name, email or password (current password required for the last two). */
export async function updateOwnAccount(
  id: string,
  input: { name?: unknown; email?: unknown; currentPassword?: unknown; newPassword?: unknown },
): Promise<Admin> {
  const { admins } = await collections();
  if (!ObjectId.isValid(id)) throw new StaffInputError("Account not found");
  const doc = await admins.findOne({ _id: new ObjectId(id) });
  if (!doc) throw new StaffInputError("Account not found");

  const set: Partial<AdminDoc> = {};
  if (typeof input.name === "string" && input.name.trim()) set.name = input.name.trim().slice(0, 80);
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : doc.email;
  const changingEmail = email !== doc.email;
  const changingPassword = typeof input.newPassword === "string" && input.newPassword.length > 0;

  if (changingEmail || changingPassword) {
    if (typeof input.currentPassword !== "string" || !(await verifyPassword(input.currentPassword, doc.passwordHash))) {
      throw new StaffInputError("Your current password isn't right");
    }
  }
  if (changingEmail) {
    if (!STAFF_EMAIL.test(email)) throw new StaffInputError("Enter a valid email");
    if (await admins.findOne({ email, _id: { $ne: doc._id } })) {
      throw new StaffInputError("Another staff account already uses that email");
    }
    set.email = email;
  }
  if (changingPassword) set.passwordHash = await hashPassword(staffPassword(input.newPassword));

  const updated = await admins.findOneAndUpdate(
    { _id: doc._id },
    { $set: set, ...(changingPassword || changingEmail ? { $inc: { sessionVersion: 1 } } : {}) },
    { returnDocument: "after" },
  );
  return serializeAdmin(updated!);
}

/** Another full admin (Settings → Admins). */
export async function createAdminAccount(input: { name?: unknown; email?: unknown; password?: unknown }): Promise<Admin> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!STAFF_EMAIL.test(email)) throw new StaffInputError("Enter a valid email");
  const password = staffPassword(input.password);
  try {
    const admin = await createAdmin({ email, password, name: typeof input.name === "string" ? input.name : undefined });
    const { admins } = await collections();
    await admins.updateOne({ _id: new ObjectId(admin.id) }, { $set: { role: "admin", providerId: null } });
    return { ...admin, role: "admin", providerId: null };
  } catch (error) {
    if (error instanceof DuplicateAdminError) throw new StaffInputError("Another staff account already uses that email");
    throw error;
  }
}

/** Sets a new password for another admin (signs them out everywhere). */
export async function resetAdminPassword(id: string, password: unknown): Promise<Admin | null> {
  return updateAdmin(id, { password: staffPassword(password) });
}

/** Removes a full admin — never the last one, never yourself. */
export async function removeAdminAccount(id: string, selfId: string): Promise<boolean> {
  if (id === selfId) throw new StaffInputError("You can't remove your own account");
  const { admins } = await collections();
  if (!ObjectId.isValid(id)) return false;
  const target = await admins.findOne({ _id: new ObjectId(id) });
  if (!target || target.role === "provider") return false;
  const fullAdmins = await admins.countDocuments({ $or: [{ role: "admin" }, { role: { $exists: false } }] });
  if (fullAdmins <= 1) throw new StaffInputError("You can't remove the only admin");
  const result = await admins.deleteOne({ _id: target._id });
  return result.deletedCount === 1;
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

export async function emailTaken(email: string): Promise<boolean> {
  const { users } = await collections();
  return Boolean(await users.findOne({ email: email.trim().toLowerCase() }));
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const { users } = await collections();
  const doc = await users.findOne({ email: email.trim().toLowerCase() });

  // Hash anyway when the email is unknown, so both failures take the same time.
  if (!doc) {
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }
  if (!(await verifyPassword(password, doc.passwordHash))) return null;

  await users.updateOne(
    { _id: doc._id },
    {
      $set: {
        lastLoginAt: new Date(),
        // Older, cheaper hashes are upgraded while the password is at hand.
        ...(needsRehash(doc.passwordHash) ? { passwordHash: await hashPassword(password) } : {}),
      },
    },
  );
  await linkGuestBookings(doc._id, doc.email);
  return serializeUser(doc);
}

/** A row for the admin patient list: the account plus its booking counts. */
export type UserRow = User & {
  lastLoginAt: string | null;
  bookingsTotal: number;
  bookingsUpcoming: number;
  bookingsCancelled: number;
  lastBookingDate: string | null;
};

export async function listUserRows(): Promise<UserRow[]> {
  const { users } = await collections();
  const todayIso = toIso(new Date());

  const rows = await users
    .aggregate<UserRow & { _id: ObjectId }>([
      {
        // Guest bookings share only the email, so match on either key.
        $lookup: {
          from: "bookings",
          let: { uid: "$_id", mail: "$email" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [{ $eq: ["$userId", "$$uid"] }, { $eq: ["$patient.email", "$$mail"] }],
                },
              },
            },
            { $project: { status: 1, date: 1 } },
          ],
          as: "b",
        },
      },
      {
        $addFields: {
          id: { $toString: "$_id" },
          bookingsTotal: { $size: "$b" },
          bookingsUpcoming: {
            $size: {
              $filter: {
                input: "$b",
                as: "x",
                cond: {
                  $and: [{ $eq: ["$$x.status", "confirmed"] }, { $gte: ["$$x.date", todayIso] }],
                },
              },
            },
          },
          bookingsCancelled: {
            $size: {
              $filter: { input: "$b", as: "x", cond: { $eq: ["$$x.status", "cancelled"] } },
            },
          },
          lastBookingDate: { $max: "$b.date" },
        },
      },
      { $project: { b: 0, passwordHash: 0 } },
      { $sort: { createdAt: -1 } },
      { $limit: 500 },
    ])
    .toArray();

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
    lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt).toISOString() : null,
    bookingsTotal: row.bookingsTotal,
    bookingsUpcoming: row.bookingsUpcoming,
    bookingsCancelled: row.bookingsCancelled,
    lastBookingDate: row.lastBookingDate ?? null,
  }));
}

export async function getUserDetail(
  id: string,
): Promise<{ user: UserRow; bookings: Booking[] } | null> {
  const { users } = await collections();
  if (!ObjectId.isValid(id)) return null;

  const doc = await users.findOne({ _id: new ObjectId(id) });
  if (!doc) return null;

  const bookings = await listUserBookings(id, doc.email);
  const todayIso = toIso(new Date());

  return {
    user: {
      ...serializeUser(doc),
      lastLoginAt: doc.lastLoginAt?.toISOString() ?? null,
      bookingsTotal: bookings.length,
      bookingsUpcoming: bookings.filter(
        (booking) => booking.status === "confirmed" && booking.date >= todayIso,
      ).length,
      bookingsCancelled: bookings.filter((booking) => booking.status === "cancelled").length,
      lastBookingDate: bookings[0]?.date ?? null,
    },
    bookings,
  };
}

/**
 * Removes a patient account together with its bookings, releasing any seat that
 * was still held. Returns what was removed so the UI can report it.
 */
export async function deleteUserAccount(
  id: string,
): Promise<{ email: string; removedBookings: number; freedSlots: number } | null> {
  const { users, bookings, slots } = await collections();
  if (!ObjectId.isValid(id)) return null;

  const user = await users.findOne({ _id: new ObjectId(id) });
  if (!user) return null;

  const owned = await bookings
    .find({ $or: [{ userId: user._id }, { "patient.email": user.email }] })
    .toArray();

  let freedSlots = 0;
  for (const booking of owned) {
    if (booking.status === "confirmed") {
      await slots.updateOne({ _id: booking.slotId }, { $inc: { booked: -1 } });
      freedSlots += 1;
    }
  }

  await bookings.deleteMany({ _id: { $in: owned.map((booking) => booking._id) } });
  await users.deleteOne({ _id: user._id });

  // Check-in photos (insurance cards, photo ID) are health information too.
  await Promise.all(
    owned
      .flatMap((booking) => [booking.intake?.cardFrontId, booking.intake?.cardBackId, booking.intake?.photoIdId])
      .map((photoId) => deletePhoto(photoId ?? null)),
  );

  const db = await getDb();
  await db.collection("email_otps").deleteOne({ email: user.email });

  return { email: user.email, removedBookings: owned.length, freedSlots };
}

/** A patient renames themselves in their panel. Returns the updated account. */
export async function updateUserName(id: string, name: string): Promise<User | null> {
  const { users } = await collections();
  if (!ObjectId.isValid(id)) return null;
  const doc = await users.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { name: name.trim().slice(0, 80) } },
    { returnDocument: "after" },
  );
  return doc ? serializeUser(doc) : null;
}

/** Changes a patient's password after checking the current one. */
export async function changeUserPassword(
  id: string,
  current: string,
  next: string,
): Promise<"ok" | "wrong-password" | "not-found"> {
  const { users } = await collections();
  if (!ObjectId.isValid(id)) return "not-found";
  const doc = await users.findOne({ _id: new ObjectId(id) });
  if (!doc) return "not-found";
  if (!(await verifyPassword(current, doc.passwordHash))) return "wrong-password";
  // A new password signs out every other browser (see sessionVersion).
  await users.updateOne(
    { _id: doc._id },
    { $set: { passwordHash: await hashPassword(next) }, $inc: { sessionVersion: 1 } },
  );
  return "ok";
}

/** The account's session version, or null when the account doesn't exist. */
export async function sessionVersionOf(kind: "admin" | "user", id: string): Promise<number | null> {
  if (!ObjectId.isValid(id)) return null;
  const { users, admins } = await collections();
  const doc =
    kind === "user"
      ? await users.findOne({ _id: new ObjectId(id) }, { projection: { sessionVersion: 1 } })
      : await admins.findOne({ _id: new ObjectId(id) }, { projection: { sessionVersion: 1 } });
  return doc ? (doc.sessionVersion ?? 0) : null;
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

export class BookingInPastError extends Error {
  constructor() {
    super("This appointment has already started or passed — call the office to change it");
    this.name = "BookingInPastError";
  }
}

/**
 * True once the appointment's start time has arrived, in Arizona time.
 * Patients can't cancel or move an appointment from that point on.
 */
export function hasStarted(booking: { date: string; time: string }): boolean {
  const today = arizonaTodayIso();
  if (booking.date !== today) return booking.date < today;
  return timeToMinutes(booking.time) <= arizonaMinutesNow();
}

/** Cancels a booking only if it belongs to this user. Frees the slot. */
export async function cancelUserBooking(
  bookingId: string,
  userId: string,
  email: string,
): Promise<CancelResult | null> {
  const { bookings } = await collections();
  if (!ObjectId.isValid(bookingId)) return null;

  const doc = await bookings.findOne({
    _id: new ObjectId(bookingId),
    $or: [{ userId: new ObjectId(userId) }, { "patient.email": email }],
  });
  if (!doc) return null;
  return cancelBookingDoc(doc);
}

/** Cancels by id — for the signed link in emails, which proves the email. */
export async function cancelBookingById(bookingId: string): Promise<CancelResult | null> {
  const { bookings } = await collections();
  if (!ObjectId.isValid(bookingId)) return null;
  const doc = await bookings.findOne({ _id: new ObjectId(bookingId) });
  return doc ? cancelBookingDoc(doc) : null;
}

/** `changed` is false when it was already cancelled — no second email then. */
export type CancelResult = { booking: Booking; changed: boolean };

async function cancelBookingDoc(doc: BookingDoc): Promise<CancelResult | null> {
  const { slots, bookings } = await collections();
  if (doc.status === "cancelled") return { booking: serializeBooking(doc), changed: false };
  if (hasStarted(doc)) throw new BookingInPastError();

  // Only the request that actually flips confirmed -> cancelled frees the
  // seat, so a double-click or two tabs can't release it twice.
  const updated = await bookings.findOneAndUpdate(
    { _id: doc._id, status: "confirmed" },
    { $set: { status: "cancelled" } },
    { returnDocument: "after" },
  );
  if (!updated) {
    const current = await bookings.findOne({ _id: doc._id });
    return current ? { booking: serializeBooking(current), changed: false } : null;
  }

  await slots.updateOne({ _id: doc.slotId }, { $inc: { booked: -1 } });
  return { booking: serializeBooking(updated), changed: true };
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
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }
  if (!(await verifyPassword(password, doc.passwordHash))) return null;

  await admins.updateOne(
    { _id: doc._id },
    {
      $set: {
        lastLoginAt: new Date(),
        ...(needsRehash(doc.passwordHash) ? { passwordHash: await hashPassword(password) } : {}),
      },
    },
  );
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
  if (!ObjectId.isValid(id)) return null;
  const set: Partial<AdminDoc> = {};
  if (patch.name?.trim()) set.name = patch.name.trim();
  if (patch.password) set.passwordHash = await hashPassword(patch.password);
  if (Object.keys(set).length === 0) return getAdminById(id);

  const doc = await admins.findOneAndUpdate(
    { _id: new ObjectId(id) },
    // A new password signs that account out everywhere.
    { $set: set, ...(patch.password ? { $inc: { sessionVersion: 1 } } : {}) },
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
  if (!ObjectId.isValid(id)) return false;
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
  if (!ObjectId.isValid(id)) return null;
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
  if (!ObjectId.isValid(id)) return false;
  const result = await plans.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount === 1;
}

/* ------------------------------------------------- price title choices -- */

type TitlesDoc = { _id: string; titles: string[]; updatedAt: Date };

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Choices for a price card's title in Admin → Pricing: titles already on a
 * card, the practice's visit reasons, and any title an admin added. Sorted,
 * no duplicates (ignoring case).
 */
export async function getPriceTitles(): Promise<string[]> {
  const db = await getDb();
  const [doc, plans] = await Promise.all([
    db.collection<TitlesDoc>("settings").findOne({ _id: "priceTitles" }),
    getPlans(),
  ]);
  const all: string[] = [];
  for (const title of [
    ...plans.map((plan) => plan.title),
    ...(doc?.titles ?? []),
    ...visitReasons.popular,
    ...visitReasons.all,
  ]) {
    const clean = title.trim();
    if (clean && !all.some((existing) => sameTitle(existing, clean))) all.push(clean);
  }
  return all.sort((a, b) => a.localeCompare(b));
}

/** Saves a new title choice. Returns the full, updated list. */
export async function addPriceTitle(title: string): Promise<string[]> {
  const clean = title.trim().replace(/\s+/g, " ").slice(0, 80);
  if (clean && !(await getPriceTitles()).some((existing) => sameTitle(existing, clean))) {
    const db = await getDb();
    await db
      .collection<TitlesDoc>("settings")
      .updateOne(
        { _id: "priceTitles" },
        { $push: { titles: clean }, $set: { updatedAt: new Date() } },
        { upsert: true },
      );
  }
  return getPriceTitles();
}

/* ---------------------------------------------------------------- slots -- */

export type SlotFilter = {
  officeId?: string | null;
  providerId?: string | null;
  /** Only providers who see patients for this visit reason. */
  allowedProviders?: string[] | null;
};

function slotFilter(filter: SlotFilter): Filter<SlotDoc> {
  const allowed = filter.allowedProviders;
  const providerClause = filter.providerId
    ? allowed && !allowed.includes(filter.providerId)
      ? { providerId: "__none__" }
      : { providerId: filter.providerId }
    : allowed
      ? { providerId: { $in: allowed } }
      : {};
  return {
    ...(filter.officeId ? { officeId: filter.officeId } : {}),
    ...providerClause,
  };
}

export async function listSlots(
  from: string,
  to: string,
  filter: SlotFilter = {},
): Promise<Slot[]> {
  const { slots } = await collections();
  const docs = await slots
    .find({ date: { $gte: from, $lte: to }, ...slotFilter(filter) })
    .sort({ date: 1, minutes: 1 })
    .toArray();
  return docs.map(serializeSlot);
}

/** Who holds a slot — just enough for the admin slot board. */
export type SlotBooking = {
  id: string;
  name: string;
  checkedIn: boolean;
  newPatient: boolean;
};

/** Confirmed bookings in a date range, keyed by slot id. */
export async function listSlotBookings(
  from: string,
  to: string,
): Promise<Record<string, SlotBooking[]>> {
  const { bookings } = await collections();
  const docs = await bookings
    .find(
      { status: "confirmed", date: { $gte: from, $lte: to } },
      { projection: { slotId: 1, patient: 1, intake: 1, patientType: 1 } },
    )
    .toArray();
  const map: Record<string, SlotBooking[]> = {};
  for (const doc of docs) {
    const key = doc.slotId.toString();
    (map[key] ??= []).push({
      id: doc._id.toString(),
      name: `${doc.patient.firstName} ${doc.patient.lastName}`,
      checkedIn: Boolean(doc.intake?.submittedAt),
      newPatient: doc.patientType === "new",
    });
  }
  return map;
}

export type SlotInput = {
  dates: string[];
  times: string[];
  capacity?: number;
  providerId: ProviderId;
  officeId: OfficeId;
};

/**
 * Adds every (date × time) pair for one provider at one office. A provider
 * can only hold one slot per date and time — duplicates are skipped, so
 * running the same batch twice is harmless.
 */
export async function createSlots(input: SlotInput): Promise<{ added: number; skipped: number }> {
  const entries = input.dates.flatMap((date) =>
    input.times.map((time) => ({
      date,
      time,
      providerId: input.providerId,
      officeId: input.officeId,
    })),
  );
  const result = await insertSlots(entries, input.capacity);
  // The week plan stays the one source of truth: an extra time joins it, so
  // saving the plan later keeps it instead of closing it.
  await syncWeekPlans(entries, "add");
  return result;
}

/**
 * Keeps saved week plans in step with one-off slot changes. Weeks that were
 * never saved need nothing — their plan is read back from the slots.
 */
async function syncWeekPlans(
  entries: { date: string; time: string; providerId: string; officeId: string }[],
  change: "add" | "remove",
): Promise<void> {
  if (entries.length === 0) return;
  const collection = await weekSchedules();
  const byWeek = new Map<string, typeof entries>();
  for (const entry of entries) {
    const week = mondayOf(entry.date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), entry]);
  }
  for (const [week, list] of byWeek) {
    const doc = await collection.findOne({ _id: week });
    if (!doc) continue;
    let rows = cleanSchedule(doc.rows);
    for (const entry of list) {
      const weekday = fromIso(entry.date).getUTCDay();
      const time = minutesToTime(timeToMinutes(entry.time));
      const row = rows.find(
        (item) =>
          item.weekday === weekday &&
          item.officeId === entry.officeId &&
          item.providerId === entry.providerId,
      );
      if (change === "add") {
        if (row) {
          if (!row.times.includes(time)) row.times.push(time);
          row.times.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
        } else if (isOfficeId(entry.officeId) && isProviderId(entry.providerId)) {
          rows.push({ weekday, officeId: entry.officeId, providerId: entry.providerId, times: [time] });
        }
      } else if (row) {
        row.times = row.times.filter((item) => item !== time);
      }
    }
    rows = rows.filter((row) => row.times.length > 0);
    // A one-off change means this week no longer just follows the fixed schedule.
    await collection.updateOne({ _id: week }, { $set: { rows, custom: true, updatedAt: new Date() } });
  }
}

async function insertSlots(
  entries: { date: string; time: string; providerId: string; officeId: string }[],
  capacity = 1,
): Promise<{ added: number; skipped: number }> {
  const { slots } = await collections();
  const docs: SlotDoc[] = entries.map((entry) => {
    const minutes = timeToMinutes(entry.time);
    return {
      _id: new ObjectId(),
      providerId: entry.providerId,
      officeId: entry.officeId,
      date: entry.date,
      time: minutesToTime(minutes),
      minutes,
      capacity: Math.max(1, capacity),
      booked: 0,
      active: true,
      createdAt: new Date(),
    };
  });

  if (docs.length === 0) return { added: 0, skipped: 0 };

  try {
    const result = await slots.insertMany(docs, { ordered: false });
    return { added: result.insertedCount, skipped: docs.length - result.insertedCount };
  } catch (error) {
    // Duplicate (date, time, provider) entries are expected — count what landed.
    const written = (error as { result?: { insertedCount?: number } })?.result?.insertedCount ?? 0;
    return { added: written, skipped: docs.length - written };
  }
}

export async function setSlotActive(id: string, active: boolean): Promise<Slot | null> {
  const { slots } = await collections();
  if (!ObjectId.isValid(id)) return null;
  const doc = await slots.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { active } },
    { returnDocument: "after" },
  );
  return doc ? serializeSlot(doc) : null;
}

export async function deleteSlot(id: string): Promise<boolean> {
  const { slots } = await collections();
  if (!ObjectId.isValid(id)) return false;
  const doc = await slots.findOneAndDelete({ _id: new ObjectId(id), booked: 0 });
  if (!doc) return false;
  // Taken out of the week plan too, so the next save doesn't bring it back.
  if (doc.providerId && doc.officeId) {
    await syncWeekPlans(
      [{ date: doc.date, time: doc.time, providerId: doc.providerId, officeId: doc.officeId }],
      "remove",
    );
  }
  return true;
}

/* ------------------------------------------------- week-by-week schedule -- */

/**
 * The practice keeps one fixed weekly schedule (settings → "masterSchedule")
 * and every week follows it: a week with no plan of its own is filled from it
 * — slots and all — as soon as it comes into view. A week the admin changes
 * on its own becomes `custom` and keeps its changes; changing the fixed
 * schedule updates every upcoming week that still follows it.
 *
 * Each week's plan is saved under its Monday. Saving a week makes its slots
 * match: new times open, times taken out close. Booked times are never
 * removed, and days already past are left as they were.
 */
type WeekScheduleDoc = {
  _id: string;
  rows: ScheduleRow[];
  /** False when the week was filled from the fixed schedule. Missing = true. */
  custom?: boolean;
  updatedAt: Date;
};

type MasterScheduleDoc = { _id: string; rows: ScheduleRow[]; updatedAt: Date };

const MASTER_DOC = "masterSchedule";
/** Weeks kept filled ahead of today, counting this one — booking looks 2 weeks out. */
const WEEKS_AHEAD = 4;
/** The furthest week the admin can open, and so the furthest one ever filled. */
const MAX_WEEKS_AHEAD = 12;

export type WeekSchedule = {
  /** Monday, YYYY-MM-DD. */
  week: string;
  rows: ScheduleRow[];
  /**
   * "saved": set for this week. "slots": never saved, so read back from the
   * times already open. "empty": nothing open — patients can't book it.
   */
  source: "saved" | "slots" | "empty";
  /** The nearest earlier week with a saved schedule, to copy from. */
  previous: { week: string; rows: ScheduleRow[] } | null;
  /** The fixed weekly schedule every week follows unless changed. */
  template: ScheduleRow[];
  /** True when this week has its own changes instead of following the fixed schedule. */
  custom: boolean;
};

export type WeekSaveResult = {
  week: string;
  rows: ScheduleRow[];
  added: number;
  removed: number;
  /** Booked times the new schedule leaves out — kept, the office must move them. */
  keptBooked: { date: string; time: string; providerId: string | null; officeId: string | null; patients: string[] }[];
};

export class PastWeekError extends Error {
  constructor() {
    super("That week is over — it can't be changed");
    this.name = "PastWeekError";
  }
}

async function weekSchedules() {
  const db = await getDb();
  return db.collection<WeekScheduleDoc>("week_schedules");
}

/** The fixed weekly schedule: what admin saved, else the one the practice sent. */
export async function getMasterSchedule(): Promise<ScheduleRow[]> {
  const db = await getDb();
  const doc = await db.collection<MasterScheduleDoc>("settings").findOne({ _id: MASTER_DOC });
  return doc ? cleanSchedule(doc.rows) : DEFAULT_WEEKLY_SCHEDULE;
}

/**
 * Fills every week from this one up to `throughIso` (at least WEEKS_AHEAD
 * weeks) that has no plan yet, from the fixed schedule. Cheap when nothing is
 * missing: one query. Runs at most once a minute per server for the default
 * range, since availability calls it on every request.
 */
let filledUntil = { monday: "", at: 0 };
export async function fillWeeksFromMaster(throughIso?: string): Promise<void> {
  const thisMonday = mondayOf(arizonaTodayIso());
  const lastAllowed = addDays(thisMonday, MAX_WEEKS_AHEAD * 7);
  const wanted = mondayOf(throughIso ?? addDays(thisMonday, (WEEKS_AHEAD - 1) * 7));
  const last = wanted > lastAllowed ? lastAllowed : wanted;
  if (last < thisMonday) return;
  if (filledUntil.monday >= last && Date.now() - filledUntil.at < 60_000) return;

  const collection = await weekSchedules();
  const have = new Set(
    (await collection.find({ _id: { $gte: thisMonday, $lte: last } }, { projection: { _id: 1 } }).toArray()).map(
      (doc) => doc._id,
    ),
  );
  let master: ScheduleRow[] | null = null;
  const { slots } = await collections();
  for (let monday = thisMonday; monday <= last; monday = addDays(monday, 7)) {
    if (have.has(monday)) continue;
    master ??= await getMasterSchedule();
    // Times already opened for this week (an extra slot added before the week
    // had a plan) are kept: merged into its plan, which makes the week its own.
    const existing = rowsFromSlots(
      await slots.find({ date: { $gte: monday, $lte: addDays(monday, 6) } }).toArray(),
    );
    const merged = mergeRows(master, existing);
    const addsTimes = JSON.stringify(merged) !== JSON.stringify(mergeRows(master, []));
    await saveWeekSchedule(monday, merged, { custom: addsTimes });
  }
  filledUntil = { monday: last, at: Date.now() };
}

/** Two schedules combined: every row of both, times unioned and in order. */
function mergeRows(base: ScheduleRow[], extra: ScheduleRow[]): ScheduleRow[] {
  const map = new Map<string, ScheduleRow>();
  for (const row of [...base, ...extra]) {
    const key = `${row.weekday}|${row.officeId}|${row.providerId}`;
    const current = map.get(key);
    const times = [...new Set([...(current?.times ?? []), ...row.times.map((time) => minutesToTime(timeToMinutes(time)))])];
    map.set(key, { ...row, times: times.sort((x, y) => timeToMinutes(x) - timeToMinutes(y)) });
  }
  return [...map.values()];
}

export type MasterSaveResult = {
  rows: ScheduleRow[];
  /** Upcoming weeks that follow the fixed schedule and were updated to it. */
  weeks: string[];
  added: number;
  removed: number;
  keptBooked: WeekSaveResult["keptBooked"];
};

/**
 * Saves the fixed weekly schedule and applies it to every upcoming week that
 * still follows it. Weeks changed on their own keep their changes.
 */
export async function saveMasterSchedule(rows: ScheduleRow[]): Promise<MasterSaveResult> {
  await ensureIndexes();
  const db = await getDb();
  await db
    .collection<MasterScheduleDoc>("settings")
    .updateOne({ _id: MASTER_DOC }, { $set: { rows, updatedAt: new Date() } }, { upsert: true });

  const thisMonday = mondayOf(arizonaTodayIso());
  const following = await (await weekSchedules())
    .find({ _id: { $gte: thisMonday }, custom: false }, { projection: { _id: 1 } })
    .sort({ _id: 1 })
    .toArray();
  const result: MasterSaveResult = { rows, weeks: [], added: 0, removed: 0, keptBooked: [] };
  for (const { _id: week } of following) {
    const saved = await saveWeekSchedule(week, rows, { custom: false });
    result.weeks.push(week);
    result.added += saved.added;
    result.removed += saved.removed;
    result.keptBooked.push(...saved.keptBooked);
  }
  filledUntil = { monday: "", at: 0 };
  await fillWeeksFromMaster();
  return result;
}

/** Schedule rows rebuilt from a week's slots, for weeks opened before they were saved. */
function rowsFromSlots(docs: SlotDoc[]): ScheduleRow[] {
  const map = new Map<string, ScheduleRow>();
  for (const doc of docs) {
    if (!isOfficeId(doc.officeId) || !isProviderId(doc.providerId)) continue;
    const weekday = fromIso(doc.date).getUTCDay();
    const key = `${weekday}:${doc.officeId}:${doc.providerId}`;
    const row = map.get(key) ?? { weekday, officeId: doc.officeId, providerId: doc.providerId, times: [] };
    if (!row.times.includes(doc.time)) row.times.push(doc.time);
    map.set(key, row);
  }
  return [...map.values()].map((row) => ({
    ...row,
    times: row.times.sort((a, b) => timeToMinutes(a) - timeToMinutes(b)),
  }));
}

export async function getWeekSchedule(anyDayOfWeek: string): Promise<WeekSchedule> {
  await ensureIndexes();
  const week = mondayOf(anyDayOfWeek);
  // An upcoming week with no plan yet follows the fixed schedule.
  await fillWeeksFromMaster(week);
  const collection = await weekSchedules();
  const [doc, earlier, template] = await Promise.all([
    collection.findOne({ _id: week }),
    collection.find({ _id: { $lt: week } }).sort({ _id: -1 }).limit(1).next(),
    getMasterSchedule(),
  ]);
  const previous = earlier ? { week: earlier._id, rows: cleanSchedule(earlier.rows) } : null;
  const base = { week, previous, template };
  if (doc) {
    return { ...base, rows: cleanSchedule(doc.rows), source: "saved", custom: doc.custom !== false };
  }

  const { slots } = await collections();
  const docs = await slots.find({ date: { $gte: week, $lte: addDays(week, 6) } }).toArray();
  const rows = rowsFromSlots(docs);
  return { ...base, rows, source: rows.length ? "slots" : "empty", custom: true };
}

/**
 * This week's opening times per office, read from the week plan — what the
 * site shows as "hours". Null when the database can't be reached, so a page
 * can still render (it says to call instead).
 */
export async function getOfficeHours(): Promise<OfficeHours | null> {
  try {
    const { rows } = await getWeekSchedule(arizonaTodayIso());
    return hoursFromSchedule(rows);
  } catch (error) {
    console.error("office hours unavailable", error);
    return null;
  }
}

export async function saveWeekSchedule(
  anyDayOfWeek: string,
  rows: ScheduleRow[],
  { custom = true }: { custom?: boolean } = {},
): Promise<WeekSaveResult> {
  await ensureIndexes();
  const week = mondayOf(anyDayOfWeek);
  const today = arizonaTodayIso();
  const last = addDays(week, 6);
  if (last < today) throw new PastWeekError();
  const first = week < today ? today : week;

  await (await weekSchedules()).updateOne(
    { _id: week },
    { $set: { rows, custom, updatedAt: new Date() } },
    { upsert: true },
  );

  // Every slot the week should have, from today on.
  type Entry = { date: string; time: string; providerId: string; officeId: string };
  const wanted = new Map<string, Entry>();
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const weekday = fromIso(date).getUTCDay();
    for (const row of rows.filter((item) => item.weekday === weekday)) {
      for (const raw of row.times) {
        const time = minutesToTime(timeToMinutes(raw));
        wanted.set(`${date}|${time}|${row.providerId}|${row.officeId}`, {
          date,
          time,
          providerId: row.providerId,
          officeId: row.officeId,
        });
      }
    }
  }

  // Compare with what is open now: keep matches, close the rest unless booked.
  const { slots, bookings } = await collections();
  const existing = await slots.find({ date: { $gte: first, $lte: last } }).toArray();
  const stale: ObjectId[] = [];
  const booked: SlotDoc[] = [];
  for (const slot of existing) {
    const key = `${slot.date}|${slot.time}|${slot.providerId}|${slot.officeId}`;
    if (wanted.delete(key)) continue;
    if (slot.booked > 0) booked.push(slot);
    else stale.push(slot._id);
  }
  // `booked: 0` again here, so a booking that lands mid-save is never lost.
  const removed = stale.length
    ? (await slots.deleteMany({ _id: { $in: stale }, booked: 0 })).deletedCount
    : 0;
  // Removal first: the same provider and time moving office reuses the slot key.
  const { added } = await insertSlots([...wanted.values()]);

  const holders = booked.length
    ? await bookings
        .find({ slotId: { $in: booked.map((slot) => slot._id) }, status: "confirmed" })
        .toArray()
    : [];
  const keptBooked = booked
    .sort((a, b) => `${a.date}${String(a.minutes).padStart(4, "0")}`.localeCompare(`${b.date}${String(b.minutes).padStart(4, "0")}`))
    .map((slot) => ({
      date: slot.date,
      time: slot.time,
      providerId: slot.providerId ?? null,
      officeId: slot.officeId ?? null,
      patients: holders
        .filter((booking) => booking.slotId.equals(slot._id))
        .map((booking) => `${booking.patient.firstName} ${booking.patient.lastName}`),
    }));

  return { week, rows, added, removed, keptBooked };
}

/* ---------------------------------------------- visit reasons per provider -- */

/** providerId -> the reasons patients can book them for. */
export type ProviderReasons = Partial<Record<ProviderId, string[]>>;

type ReasonsDoc = { _id: string; reasons: ProviderReasons; updatedAt: Date };

/**
 * Stored under its own id: lists saved before the reasons took their Zocdoc
 * names (under "providerReasons") used the old names and are left unused.
 */
const REASONS_DOC = "providerVisitReasons";

/**
 * Every provider's visit reasons: what admin saved, else their Zocdoc list.
 * Kept in the master order so dropdowns read the same everywhere.
 */
export async function getProviderReasons(): Promise<Record<ProviderId, string[]>> {
  await ensureIndexes();
  const db = await getDb();
  const doc = await db.collection<ReasonsDoc>("settings").findOne({ _id: REASONS_DOC });
  const saved = doc?.reasons ?? {};
  return Object.fromEntries(
    providerIds().map((id) => {
      const fallback = [...(zocdocReasons[id] ?? ALL_VISIT_REASONS)];
      const own = (saved[id] ?? []).filter((reason) => ALL_VISIT_REASONS.includes(reason));
      if (own.length === 0) return [id, fallback];
      // Admin's ticks, in the provider's Zocdoc order, then any extras.
      const ordered = [
        ...fallback.filter((reason) => own.includes(reason)),
        ...ALL_VISIT_REASONS.filter((reason) => own.includes(reason) && !fallback.includes(reason)),
      ];
      return [id, ordered];
    }),
  ) as Record<ProviderId, string[]>;
}

/** One provider's visit reasons (Admin → Doctors), keeping everyone else's. */
export async function saveReasonsFor(providerId: string, reasons: string[]): Promise<string[]> {
  const db = await getDb();
  const doc = await db.collection<ReasonsDoc>("settings").findOne({ _id: REASONS_DOC });
  const clean = [...new Set(reasons.filter((reason) => ALL_VISIT_REASONS.includes(reason)))];
  if (clean.length === 0) throw new ProviderInputError("Pick at least one visit reason");
  await saveProviderReasons({ ...(doc?.reasons ?? {}), [providerId]: clean });
  return clean;
}

export async function saveProviderReasons(reasons: ProviderReasons): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  await db
    .collection<ReasonsDoc>("settings")
    .updateOne(
      { _id: REASONS_DOC },
      { $set: { reasons, updatedAt: new Date() } },
      { upsert: true },
    );
}

/** Providers who see this reason, or null when no reason is given. */
export async function providersForReason(reason: string | null | undefined): Promise<string[] | null> {
  if (!reason) return null;
  const map = await getProviderReasons();
  return providerIds().filter((id) => map[id].includes(reason));
}

/* --------------------------------------------------------- availability -- */

export async function getAvailability(
  startIso: string,
  days: number,
  filter: SlotFilter = {},
): Promise<DayAvailability[]> {
  // Weeks in view that have no plan yet follow the fixed schedule.
  await fillWeeksFromMaster(addDays(startIso, days - 1)).catch((error) =>
    console.error("could not fill weeks from the fixed schedule", error),
  );
  const { slots } = await collections();
  const todayIso = arizonaTodayIso();
  const from = startIso < todayIso ? todayIso : startIso;
  const to = addDays(startIso, days - 1);
  // A time that has already passed today is not bookable, even if it is open.
  const nowMinutes = arizonaMinutesNow();

  const docs = await slots
    .find({
      date: { $gte: from, $lte: to },
      active: true,
      $expr: { $lt: ["$booked", "$capacity"] },
      ...slotFilter(filter),
    })
    .sort({ date: 1, minutes: 1 })
    .toArray();

  const byDate = new Map<string, DaySlot[]>();
  for (const doc of docs) {
    if (doc.date === todayIso && doc.minutes <= nowMinutes) continue;
    byDate.set(doc.date, [
      ...(byDate.get(doc.date) ?? []),
      {
        id: doc._id.toString(),
        time: doc.time,
        providerId: doc.providerId ?? null,
        officeId: doc.officeId ?? null,
      },
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
  lang?: "en" | "es";
  via?: "account" | "guest" | "staff";
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
    providerId: slot.providerId ?? null,
    officeId: slot.officeId ?? null,
    userId: input.userId && ObjectId.isValid(input.userId) ? new ObjectId(input.userId) : null,
    date: slot.date,
    time: slot.time,
    reason: input.reason,
    patientType: input.patientType,
    insurance: input.insurance,
    patient: input.patient,
    status: "confirmed",
    lang: input.lang ?? "en",
    via: input.via ?? "account",
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

/* -------------------------------------------------------- admin dashboard -- */

export type Dashboard = {
  today: string;
  todays: Booking[];
  kpis: {
    todayCount: number;
    todayCheckedIn: number;
    next7: number;
    openNext14: number;
    fillNext14: number;
    completed30: number;
    cancelRate30: number;
    newPatients30: number;
  };
  /** Next 14 days: booked vs. all bookable times, per day. */
  ahead: { date: string; booked: number; total: number }[];
  /** Last 8 weeks (Monday first): visits that happened. */
  weeks: { week: string; visits: number }[];
  providers: {
    id: string;
    today: number;
    next7: number;
    fill: number;
    checkedIn: number;
    upcoming: number;
  }[];
  /** Shares among upcoming confirmed visits. */
  mix: { label: string; part: number; total: number }[];
  recent: Booking[];
};

/** Everything the admin dashboard shows, from one pass over recent data. */
export async function getDashboard(): Promise<Dashboard> {
  const { slots, bookings } = await collections();
  const today = arizonaTodayIso();
  const nowMinutes = arizonaMinutesNow();
  const from = addDays(mondayOf(today), -7 * 7);
  const horizon = addDays(today, 13);

  const [bookingDocs, slotDocs, recentDocs] = await Promise.all([
    bookings.find({ date: { $gte: from } }).toArray(),
    slots.find({ date: { $gte: today, $lte: horizon }, active: true }).toArray(),
    bookings.find().sort({ createdAt: -1 }).limit(8).toArray(),
  ]);
  const all = bookingDocs.map(serializeBooking);
  const confirmed = all.filter((booking) => booking.status === "confirmed");
  const isPast = (booking: Booking) =>
    booking.date < today || (booking.date === today && timeToMinutes(booking.time) <= nowMinutes);
  const upcoming = confirmed.filter((booking) => !isPast(booking));
  const monthAgo = addDays(today, -30);
  const last30 = all.filter((booking) => booking.date >= monthAgo && booking.date < today);

  const todays = confirmed
    .filter((booking) => booking.date === today)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const next7End = addDays(today, 6);
  const slotsBooked = slotDocs.reduce((sum, slot) => sum + Math.min(slot.booked, slot.capacity), 0);
  const slotsTotal = slotDocs.reduce((sum, slot) => sum + slot.capacity, 0);

  const ahead = Array.from({ length: 14 }, (_, index) => {
    const date = addDays(today, index);
    const day = slotDocs.filter((slot) => slot.date === date);
    return {
      date,
      booked: day.reduce((sum, slot) => sum + Math.min(slot.booked, slot.capacity), 0),
      total: day.reduce((sum, slot) => sum + slot.capacity, 0),
    };
  });

  const weeks = Array.from({ length: 8 }, (_, index) => {
    const week = addDays(mondayOf(today), -7 * (7 - index));
    const end = addDays(week, 6);
    return {
      week,
      visits: confirmed.filter((booking) => booking.date >= week && booking.date <= end && isPast(booking))
        .length,
    };
  });

  const providers = providerIds().map((id) => {
    const mine = upcoming.filter((booking) => booking.providerId === id);
    const mySlots = slotDocs.filter((slot) => slot.providerId === id);
    const total = mySlots.reduce((sum, slot) => sum + slot.capacity, 0);
    return {
      id,
      today: todays.filter((booking) => booking.providerId === id).length,
      next7: mine.filter((booking) => booking.date <= next7End).length,
      fill: total
        ? mySlots.reduce((sum, slot) => sum + Math.min(slot.booked, slot.capacity), 0) / total
        : 0,
      checkedIn: mine.filter((booking) => booking.intake?.submittedAt).length,
      upcoming: mine.length,
    };
  });

  const share = (label: string, test: (booking: Booking) => boolean) => ({
    label,
    part: upcoming.filter(test).length,
    total: upcoming.length,
  });

  return {
    today,
    todays,
    kpis: {
      todayCount: todays.length,
      todayCheckedIn: todays.filter((booking) => booking.intake?.submittedAt).length,
      next7: upcoming.filter((booking) => booking.date <= next7End).length,
      openNext14: slotsTotal - slotsBooked,
      fillNext14: slotsTotal ? slotsBooked / slotsTotal : 0,
      completed30: last30.filter((booking) => booking.status === "confirmed").length,
      cancelRate30: last30.length
        ? last30.filter((booking) => booking.status === "cancelled").length / last30.length
        : 0,
      newPatients30: last30.filter((booking) => booking.status === "confirmed" && booking.patientType === "new")
        .length,
    },
    ahead,
    weeks,
    providers,
    mix: [
      share("Checked in", (booking) => Boolean(booking.intake?.submittedAt)),
      share("New patients", (booking) => booking.patientType === "new"),
      share("Booked online", (booking) => booking.via !== "staff"),
      share("With insurance", (booking) => Boolean(booking.insurance)),
      share("Spanish speaking", (booking) => booking.lang === "es"),
    ],
    recent: recentDocs.map(serializeBooking),
  };
}

/** Every booking for one provider, newest appointment first (for their panel). */
export async function listProviderBookings(providerId: string): Promise<Booking[]> {
  const { bookings } = await collections();
  const docs = await bookings
    .find({ providerId })
    .sort({ date: -1, createdAt: -1 })
    .limit(2000)
    .toArray();
  return docs.map(serializeBooking);
}

/** Who, when and whether a slot can still be booked — for staff bookings. */
export async function getSlotInfo(
  slotId: string,
): Promise<{ providerId: string | null; date: string; time: string; open: boolean } | null> {
  const { slots } = await collections();
  if (!ObjectId.isValid(slotId)) return null;
  const doc = await slots.findOne({ _id: new ObjectId(slotId) });
  if (!doc) return null;
  return {
    providerId: doc.providerId ?? null,
    date: doc.date,
    time: doc.time,
    open: doc.active && doc.booked < doc.capacity,
  };
}

/** The provider a slot belongs to, for checking booking rules. */
export async function getSlotProvider(slotId: string): Promise<string | null> {
  const { slots } = await collections();
  if (!ObjectId.isValid(slotId)) return null;
  const doc = await slots.findOne({ _id: new ObjectId(slotId) }, { projection: { providerId: 1 } });
  return doc?.providerId ?? null;
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const { bookings } = await collections();
  if (!ObjectId.isValid(id)) return null;
  const doc = await bookings.findOne({ _id: new ObjectId(id) });
  return doc ? serializeBooking(doc) : null;
}

/**
 * The booking a signed appointment link opens, or null when the link is
 * forged, the booking is gone, or the link has expired (30 days after the
 * visit). Every page and route that takes a manage token goes through here.
 */
export async function getBookingByToken(token: string): Promise<Booking | null> {
  const id = bookingIdFromToken(token);
  if (!id) return null;
  const booking = await getBookingById(id);
  if (!booking || manageLinkExpired(booking.date, arizonaTodayIso())) return null;
  return booking;
}

/** Confirmed visits from today on that were booked under this email. */
export async function countUpcomingBookings(email: string): Promise<number> {
  const { bookings } = await collections();
  return bookings.countDocuments({
    "patient.email": email.trim().toLowerCase(),
    status: "confirmed",
    date: { $gte: arizonaTodayIso() },
  });
}

/** The account that owns this email, if any — guest bookings attach to it. */
export async function userIdByEmail(email: string): Promise<string | null> {
  const { users } = await collections();
  const doc = await users.findOne({ email: email.trim().toLowerCase() }, { projection: { _id: 1 } });
  return doc ? doc._id.toString() : null;
}

export async function markConfirmationSent(id: string): Promise<void> {
  const { bookings } = await collections();
  await bookings.updateOne({ _id: new ObjectId(id) }, { $set: { confirmationSentAt: new Date().toISOString() } });
}

export type ReminderKey = "threeDay" | "oneDay";

/** Confirmed bookings on `date` that haven't had this reminder yet. */
export async function listReminderCandidates(date: string, key: ReminderKey): Promise<Booking[]> {
  const { bookings } = await collections();
  const docs = await bookings
    .find({ date, status: "confirmed", [`reminders.${key}`]: { $exists: false } })
    .limit(500)
    .toArray();
  return docs.map(serializeBooking);
}

/**
 * Claims the reminder before sending, so two overlapping cron runs can't both
 * send it. Returns false if another run got there first.
 */
export async function claimReminder(id: string, key: ReminderKey): Promise<boolean> {
  const { bookings } = await collections();
  const result = await bookings.updateOne(
    { _id: new ObjectId(id), [`reminders.${key}`]: { $exists: false } },
    { $set: { [`reminders.${key}`]: new Date().toISOString() } },
  );
  return result.modifiedCount === 1;
}

export async function saveIntake(id: string, intake: Intake): Promise<Booking | null> {
  const { bookings } = await collections();
  const doc = await bookings.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { intake } },
    { returnDocument: "after" },
  );
  return doc ? serializeBooking(doc) : null;
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
  if (!ObjectId.isValid(id)) return null;
  const _id = new ObjectId(id);
  const existing = await bookings.findOne({ _id });
  if (!existing || existing.status === status) {
    return existing ? serializeBooking(existing) : null;
  }

  if (status === "cancelled") {
    // Only the request that flips confirmed -> cancelled frees the seat, so a
    // double-click or two admins can't release it twice.
    const doc = await bookings.findOneAndUpdate(
      { _id, status: "confirmed" },
      { $set: { status } },
      { returnDocument: "after" },
    );
    if (!doc) return serializeBooking((await bookings.findOne({ _id })) ?? existing);
    await slots.updateOne({ _id: doc.slotId }, { $inc: { booked: -1 } });
    return serializeBooking(doc);
  }

  // Un-cancelling takes the seat back — only if the time is still free.
  const seat = await slots.findOneAndUpdate(
    { _id: existing.slotId, $expr: { $lt: ["$booked", "$capacity"] } },
    { $inc: { booked: 1 } },
  );
  if (!seat) throw new SlotUnavailableError();
  const doc = await bookings.findOneAndUpdate(
    { _id, status: "cancelled" },
    { $set: { status } },
    { returnDocument: "after" },
  );
  if (!doc) {
    // Someone else changed it meanwhile — give the seat back.
    await slots.updateOne({ _id: existing.slotId }, { $inc: { booked: -1 } });
    return serializeBooking((await bookings.findOne({ _id })) ?? existing);
  }
  return serializeBooking(doc);
}

export async function deleteBooking(id: string): Promise<boolean> {
  const { slots, bookings } = await collections();
  if (!ObjectId.isValid(id)) return false;
  // Atomic: of two deletes racing, only one gets the document and frees the seat.
  const doc = await bookings.findOneAndDelete({ _id: new ObjectId(id) });
  if (!doc) return false;

  if (doc.status === "confirmed") {
    await slots.updateOne({ _id: doc.slotId }, { $inc: { booked: -1 } });
  }
  // Check-in photos are health information — they go with the booking.
  const photos = [doc.intake?.cardFrontId, doc.intake?.cardBackId, doc.intake?.photoIdId];
  await Promise.all(photos.map((photoId) => deletePhoto(photoId ?? null)));
  return true;
}

/* -------------------------------------------- site content (hero, offices) -- */

type SiteContentDoc = SiteContent & { _id: string; updatedAt?: Date };

const SITE_CONTENT_DOC = "siteContent";
const SITE_CONTENT_TTL_MS = 30_000;
const SITE_IMAGE_URL = /^\/api\/site-images\/([a-f\d]{24})$/;
let siteContentLoading: Promise<SiteContent> | null = null;

/**
 * Reads the hero and office cards into lib/site-content (writing the
 * starting content on a fresh database). Same 30-second cache as providers.
 */
export async function loadSiteContent(force = false): Promise<SiteContent> {
  if (!force && Date.now() - siteContentLoadedAt() < SITE_CONTENT_TTL_MS) return getSiteContent();
  if (siteContentLoading && !force) return siteContentLoading;
  siteContentLoading = (async () => {
    const db = await getDb();
    const collection = db.collection<SiteContentDoc>("settings");
    let doc = await collection.findOne({ _id: SITE_CONTENT_DOC });
    if (!doc) {
      await collection
        .updateOne(
          { _id: SITE_CONTENT_DOC },
          { $setOnInsert: { ...DEFAULT_SITE_CONTENT, updatedAt: new Date() } },
          { upsert: true },
        )
        .catch(() => undefined);
      doc = await collection.findOne({ _id: SITE_CONTENT_DOC });
    }
    const content: SiteContent = doc ? { hero: doc.hero, offices: doc.offices } : DEFAULT_SITE_CONTENT;
    setSiteContent(content);
    markSiteContentLoaded(Date.now());
    return content;
  })().finally(() => {
    siteContentLoading = null;
  });
  return siteContentLoading;
}

export class SiteContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteContentError";
  }
}

function text(value: unknown, field: string, max: number, required = true): string {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (required && !clean) throw new SiteContentError(`${field} can't be empty`);
  if (clean.length > max) throw new SiteContentError(`${field} is too long (${max} characters max)`);
  return clean;
}

function focusPoint(value: unknown, field: string): string {
  const match = typeof value === "string" ? value.trim().match(/^(\d{1,3})% (\d{1,3})%$/) : null;
  if (!match || Number(match[1]) > 100 || Number(match[2]) > 100) {
    throw new SiteContentError(`${field}: the focus point must look like "50% 40%"`);
  }
  return `${Number(match[1])}% ${Number(match[2])}%`;
}

function cleanImage(value: unknown, field: string): ImageRef {
  const input = (value ?? {}) as Record<string, unknown>;
  const url = typeof input.url === "string" && SITE_IMAGE_URL.test(input.url) ? input.url : null;
  const photo = !url && typeof input.photo === "string" && input.photo in photos ? (input.photo as PhotoKey) : null;
  if (!url && !photo) throw new SiteContentError(`${field}: choose a picture`);
  return {
    photo,
    url,
    // An upload needs its own description; a library photo has one.
    alt: text(input.alt, `${field} description`, 200, Boolean(url)),
    position: focusPoint(input.position ?? "50% 50%", field),
  };
}

/** Validates everything the editor sends; throws SiteContentError with a readable message. */
export function cleanSiteContent(input: unknown): SiteContent {
  const body = (input ?? {}) as { hero?: Record<string, unknown>; offices?: unknown };
  const hero = body.hero ?? {};
  const slides = Array.isArray(hero.slides) ? hero.slides : [];
  if (slides.length < 1) throw new SiteContentError("The hero needs at least one picture");
  if (slides.length > 6) throw new SiteContentError("The hero can have up to 6 pictures");

  const offices = Array.isArray(body.offices) ? body.offices : [];
  const byId = new Map(
    offices.map((office) => [(office as Record<string, unknown>)?.id, office as Record<string, unknown>]),
  );
  if (byId.size !== OFFICE_IDS.length || !OFFICE_IDS.every((id) => byId.has(id))) {
    throw new SiteContentError("Both offices must be sent");
  }

  return {
    hero: {
      eyebrow: text(hero.eyebrow, "Small heading", 120, false),
      title: text(hero.title, "Headline", 120),
      emphasis: text(hero.emphasis, "Highlighted words", 80, false),
      body: text(hero.body, "Hero text", 400),
      slides: slides.map((raw, index) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        const label = `Picture ${index + 1}`;
        return {
          image: cleanImage(item.image, label),
          mobilePosition: focusPoint(item.mobilePosition ?? "50% 50%", `${label} (phone)`),
          title: text(item.title, `${label} caption`, 60),
          body: text(item.body, `${label} caption text`, 200, false),
        };
      }),
    },
    offices: OFFICE_IDS.map((id) => {
      const item = byId.get(id)!;
      const label = text(item.name, "Office name", 60);
      const address = Array.isArray(item.address) ? item.address : [];
      const maps = typeof item.maps === "string" ? item.maps.trim() : "";
      if (!/^https:\/\/[^\s]+$/i.test(maps) || maps.length > 500) {
        throw new SiteContentError(`${label}: the directions link must start with https://`);
      }
      const phone = typeof item.phone === "string" ? item.phone.trim() : "";
      if (phone && !/^[\d\s()+.-]{7,20}$/.test(phone)) {
        throw new SiteContentError(`${label}: that phone number doesn't look right`);
      }
      return {
        id,
        name: label,
        area: text(item.area, `${label} short name`, 40),
        address: [text(address[0], `${label} street`, 100), text(address[1], `${label} city, state and ZIP`, 100)],
        maps,
        phone: phone || null,
        image: cleanImage(item.image, `${label} picture`),
      };
    }),
  };
}

function uploadedIds(content: SiteContent): Set<string> {
  const urls = [
    ...content.hero.slides.map((slide) => slide.image.url),
    ...content.offices.map((office) => office.image.url),
  ];
  return new Set(urls.map((url) => url?.match(SITE_IMAGE_URL)?.[1]).filter((id): id is string => Boolean(id)));
}

function siteImageBucket(db: Awaited<ReturnType<typeof getDb>>) {
  return new GridFSBucket(db, { bucketName: "site_images" });
}

/** Saves the hero and office cards; uploads no longer used are deleted. */
export async function saveSiteContent(input: unknown): Promise<SiteContent> {
  const content = cleanSiteContent(input);
  const db = await getDb();
  const bucket = siteImageBucket(db);
  const wanted = [...uploadedIds(content)];
  if (wanted.length) {
    const found = await bucket.find({ _id: { $in: wanted.map((id) => new ObjectId(id)) } }).toArray();
    if (found.length !== wanted.length) throw new SiteContentError("One of the pictures is missing — upload it again");
  }
  const before = await loadSiteContent(true);
  await db
    .collection<SiteContentDoc>("settings")
    .updateOne({ _id: SITE_CONTENT_DOC }, { $set: { ...content, updatedAt: new Date() } }, { upsert: true });
  const keep = new Set(wanted);
  for (const id of uploadedIds(before)) {
    if (!keep.has(id)) await bucket.delete(new ObjectId(id)).catch(() => undefined);
  }
  setSiteContent(content);
  markSiteContentLoaded(Date.now());
  return content;
}

/** True if the bytes really are a JPEG, PNG or WebP (not just named like one). */
function looksLikeImage(data: Buffer): boolean {
  return (
    (data[0] === 0xff && data[1] === 0xd8) ||
    data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ||
    (data.toString("latin1", 0, 4) === "RIFF" && data.toString("latin1", 8, 12) === "WEBP")
  );
}

/** Stores a picture for the hero or an office card; returns its URL. */
export async function uploadSiteImage(file: File): Promise<string> {
  if (!PHOTO_TYPES.has(file.type)) throw new SiteContentError("Use a JPEG, PNG or WebP picture");
  if (file.size > 8 * 1024 * 1024) throw new SiteContentError("That picture is too large (8 MB max)");
  const data = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(data)) throw new SiteContentError("That file isn't a picture");
  const db = await getDb();
  const fileId = new ObjectId();
  await new Promise<void>((resolve, reject) => {
    const upload = siteImageBucket(db).openUploadStreamWithId(fileId, "site-image", {
      metadata: { contentType: file.type },
    });
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(data);
  });
  return `/api/site-images/${fileId.toString()}`;
}

export async function readSiteImage(fileId: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!ObjectId.isValid(fileId)) return null;
  const db = await getDb();
  const bucket = siteImageBucket(db);
  const [file] = await bucket.find({ _id: new ObjectId(fileId) }).limit(1).toArray();
  if (!file) return null;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    bucket
      .openDownloadStream(file._id)
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("end", () => resolve())
      .on("error", reject);
  });
  const contentType = (file.metadata as { contentType?: string } | undefined)?.contentType ?? "image/jpeg";
  return { data: Buffer.concat(chunks), contentType };
}
