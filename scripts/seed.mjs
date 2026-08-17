/**
 * Seeds MongoDB: the admin account, the pricing plans and (optionally) slots.
 *
 *   npm run seed
 *   npm run seed -- --email front@desk.com --password "s3cret pass" --name "Front desk"
 *   npm run seed -- --slots 14          # also create 14 days of weekday slots
 *
 * Re-running is safe: the admin's password is reset to the one given, plans are
 * only inserted when the collection is empty, and duplicate slots are skipped.
 */
import "./load-env.mjs";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { MongoClient, ObjectId } from "mongodb";

const scryptAsync = promisify(scrypt);

/* ------------------------------------------------------------- defaults -- */

const DEFAULT_ADMIN = {
  email: "admin@arizonawomen.com",
  password: "Arizona@2026",
  name: "Arizona Women Specialists",
};

const PLANS = [
  { tag: "New Patient", tagIcon: "star", amount: "$100", title: "New Patient Visit", body: "Comprehensive initial consultation and exam." },
  { tag: "Returning", tagIcon: "check", amount: "$75", title: "Established Patient Visit", body: "Follow-up care and routine monitoring." },
  { tag: "Imaging", tagIcon: "waves", amount: "$75", title: "Ultrasound", body: "OB & GYN ultrasounds." },
  { tag: "Birth Control", tagIcon: "shield", amount: "$50", title: "Depo Shot", body: "Contraceptive injection." },
  { tag: "Birth Control", tagIcon: "shield", amount: "$150", title: "IUD Insertion", body: "Mirena, Paragard, Liletta, Kyleena & more." },
  { tag: "Birth Control", tagIcon: "shield", amount: "$100", title: "IUD Removal", body: "All IUDs, Nexplanon & more." },
];

const SLOT_TIMES = [
  "8:00 am", "8:45 am", "9:30 am", "10:15 am", "11:00 am", "11:45 am",
  "1:00 pm", "1:45 pm", "2:30 pm", "3:15 pm", "4:00 pm", "4:45 pm",
];

/* ---------------------------------------------------------------- utils -- */

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

/** Same format src/lib/password.ts reads: scrypt$N$r$p$salt$hash, base64url. */
async function hashPassword(password) {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, 64, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  });
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

function timeToMinutes(time) {
  const [, h, m, suffix] = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(time.trim());
  let hours = Number(h) % 12;
  if (suffix.toLowerCase() === "pm") hours += 12;
  return hours * 60 + Number(m);
}

function isoAddDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/* ----------------------------------------------------------------- seed -- */

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "arizona";

if (!uri) {
  console.error("MONGODB_URI is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

const admin = {
  email: arg("email", DEFAULT_ADMIN.email).trim().toLowerCase(),
  password: arg("password", DEFAULT_ADMIN.password),
  name: arg("name", DEFAULT_ADMIN.name),
};
const slotDays = Number(arg("slots", 0));

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });

try {
  await client.connect();
  const db = client.db(dbName);
  console.log(`Connected to ${dbName}.`);

  // Indexes
  await db.collection("admins").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("bookings").createIndex({ userId: 1, date: -1 });
  await db.collection("bookings").createIndex({ "patient.email": 1 });
  await db.collection("slots").createIndex({ date: 1, time: 1 }, { unique: true });
  await db.collection("slots").createIndex({ date: 1, active: 1 });
  await db.collection("bookings").createIndex({ createdAt: -1 });
  await db.collection("bookings").createIndex({ date: 1, time: 1 });
  await db.collection("plans").createIndex({ order: 1 });

  // Admin — upsert so re-running resets the password rather than failing.
  const passwordHash = await hashPassword(admin.password);
  const existing = await db.collection("admins").findOne({ email: admin.email });

  await db.collection("admins").updateOne(
    { email: admin.email },
    {
      $set: { name: admin.name, passwordHash },
      $setOnInsert: { createdAt: new Date(), lastLoginAt: null },
    },
    { upsert: true },
  );
  console.log(
    existing
      ? `Admin ${admin.email} already existed — password reset.`
      : `Admin created: ${admin.email}`,
  );
  console.log(`  password: ${admin.password}`);

  // Plans — only when empty, so edits made in /admin/pricing survive a re-seed.
  const planCount = await db.collection("plans").countDocuments();
  if (planCount === 0) {
    await db.collection("plans").insertMany(
      PLANS.map((plan, order) => ({ _id: new ObjectId(), order, ...plan })),
    );
    console.log(`Inserted ${PLANS.length} pricing plans.`);
  } else {
    console.log(`Pricing plans already present (${planCount}) — left alone.`);
  }

  // Slots — opt in with --slots <days>. Weekdays only, one patient per time.
  if (slotDays > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const docs = [];
    for (let index = 0; index < slotDays; index += 1) {
      const date = isoAddDays(today, index);
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      for (const time of SLOT_TIMES) {
        docs.push({
          _id: new ObjectId(),
          date,
          time,
          minutes: timeToMinutes(time),
          capacity: 1,
          booked: 0,
          active: true,
          createdAt: new Date(),
        });
      }
    }
    let added = 0;
    try {
      const result = await db.collection("slots").insertMany(docs, { ordered: false });
      added = result.insertedCount;
    } catch (error) {
      added = error?.result?.insertedCount ?? 0;
    }
    console.log(`Slots: ${added} added, ${docs.length - added} already existed.`);
  }

  console.log("\nDone. Sign in at /admin/login.");
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
