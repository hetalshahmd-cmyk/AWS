/**
 * Seeds MongoDB: the admin account, the pricing plans and the indexes.
 *
 *   npm run seed -- --password "a long, unique password"
 *   npm run seed -- --email front@desk.com --password "…" --name "Front desk"
 *   npm run seed -- --password "…" --doctors --doctor-password "…"   also one login per provider
 *
 * There are no default passwords: every account gets the one you pass, at
 * least 12 characters. Passwords are never printed.
 *
 * Provider logins use the same sign-in page (/admin/login) and only see their
 * own appointments: shah@, denton@ and tate@arizonawomen.com.
 *
 * Appointment slots are not created here any more: every slot now belongs to
 * a provider at an office, and they come from Admin → Weekly schedule.
 *
 * Re-running is safe: the admin's password is reset to the one given and plans
 * are only inserted when the collection is empty.
 */
import "./load-env.mjs";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { MongoClient, ObjectId } from "mongodb";

const scryptAsync = promisify(scrypt);

/* ------------------------------------------------------------- defaults -- */

const DEFAULT_ADMIN = {
  email: "admin@arizonawomen.com",
  name: "Arizona Women Specialists",
};

/** Passwords that were once documented as defaults — never accepted again. */
const RETIRED = new Set(["arizona@2026", "doctor@2026", "demo@2026"]);

/** Exits unless the password is long enough and not a retired default. */
function requirePassword(value, flag) {
  if (!value) {
    console.error(`Give a password with ${flag} "…" (at least 12 characters). There is no default.`);
    process.exit(1);
  }
  if (value.length < 12) {
    console.error(`${flag}: use at least 12 characters.`);
    process.exit(1);
  }
  if (RETIRED.has(value.toLowerCase())) {
    console.error(`${flag}: that password was a published default — pick a new one.`);
    process.exit(1);
  }
  return value;
}

/** One sign-in per provider. Ids match `providers` in src/lib/site.ts. */
const DOCTORS = [
  { providerId: "shah", email: "shah@arizonawomen.com", name: "Dr. Hetalkumar Shah, MD" },
  { providerId: "denton", email: "denton@arizonawomen.com", name: "Julie Denton, NP" },
  { providerId: "tate", email: "tate@arizonawomen.com", name: "Kylee Tate, PA-C" },
];

const PLANS = [
  { tag: "New Patient", tagIcon: "star", amount: "$100", title: "New Patient Visit", body: "Comprehensive initial consultation and exam." },
  { tag: "Returning", tagIcon: "check", amount: "$75", title: "Established Patient Visit", body: "Follow-up care and routine monitoring." },
  { tag: "Imaging", tagIcon: "waves", amount: "$75", title: "Ultrasound", body: "OB & GYN ultrasounds." },
  { tag: "Birth Control", tagIcon: "shield", amount: "$50", title: "Depo Shot", body: "Contraceptive injection." },
  { tag: "Birth Control", tagIcon: "shield", amount: "$150", title: "IUD Insertion", body: "Mirena, Paragard, Liletta, Kyleena & more." },
  { tag: "Birth Control", tagIcon: "shield", amount: "$100", title: "IUD Removal", body: "All IUDs, Nexplanon & more." },
];

/* ---------------------------------------------------------------- utils -- */

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

/** Same format src/lib/password.ts reads: scrypt$N$r$p$salt$hash, base64url. */
async function hashPassword(password) {
  // Kept in step with src/lib/password.ts.
  const N = 131072;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, 64, {
    N,
    r,
    p,
    maxmem: 256 * 1024 * 1024,
  });
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
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
  password: requirePassword(arg("password", ""), "--password"),
  name: arg("name", DEFAULT_ADMIN.name),
};
if (arg("slots", 0)) {
  console.warn(
    "--slots is no longer supported: slots belong to a provider and an office now.\n" +
      "Open them from Admin → Weekly schedule instead.",
  );
}

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
  // Unique per provider, not per practice — two providers can share an hour.
  // Kept in step with ensureIndexes() in src/lib/db.ts.
  await db.collection("slots").dropIndex("date_1_time_1").catch(() => undefined);
  await db.collection("slots").createIndex({ date: 1, time: 1, providerId: 1 }, { unique: true });
  await db.collection("slots").createIndex({ date: 1, officeId: 1, providerId: 1 });
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
      // This command makes a full admin, even if the email was a provider's.
      $set: { name: admin.name, passwordHash, role: "admin", providerId: null },
      $setOnInsert: { createdAt: new Date(), lastLoginAt: null },
    },
    { upsert: true },
  );
  console.log(
    existing
      ? `Admin ${admin.email} already existed — password reset.`
      : `Admin created: ${admin.email}`,
  );

  // Provider logins — only with --doctors. Re-running resets their passwords.
  if (process.argv.includes("--doctors")) {
    const doctorPassword = requirePassword(arg("doctor-password", ""), "--doctor-password");
    const doctorHash = await hashPassword(doctorPassword);
    for (const doctor of DOCTORS) {
      await db.collection("admins").updateOne(
        { email: doctor.email },
        {
          $set: { name: doctor.name, passwordHash: doctorHash, role: "provider", providerId: doctor.providerId },
          $setOnInsert: { createdAt: new Date(), lastLoginAt: null },
        },
        { upsert: true },
      );
      console.log(`Provider login: ${doctor.email}  (${doctor.name})`);
    }
  }

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

  console.log("\nDone. Sign in at /admin/login.");
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
