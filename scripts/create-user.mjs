/**
 * Creates (or resets) a patient account directly, skipping the emailed code.
 * For the front desk and for testing — patients normally sign up at /register.
 *
 *   npm run create-user -- --email patient@example.com --password "s3cret pass" --name "Jane Doe"
 *
 * The emailed code only gates sign-up; an account in `users` can log in at
 * /login straight away. Re-running with the same email resets the password and
 * name. To create the account on the live site, run it with the live database
 * in the environment (real env vars win over .env.local, as with the doctor):
 *
 *   MONGODB_URI="mongodb+srv://…" MONGODB_DB=arizona npm run create-user -- --email …
 */
import "./load-env.mjs";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { MongoClient, ObjectId } from "mongodb";

const scryptAsync = promisify(scrypt);

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
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

const email = (arg("email") ?? "").trim().toLowerCase();
const password = arg("password") ?? "";
const name = (arg("name") ?? "").trim() || email.split("@")[0];

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Give a valid --email.");
  process.exit(1);
}
// Same rule the sign-up form enforces.
if (password.length < 8) {
  console.error("Give a --password of at least 8 characters.");
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "arizona";
if (!uri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const users = client.db(dbName).collection("users");
  const passwordHash = await hashPassword(password);
  const result = await users.updateOne(
    { email },
    {
      $set: { name, passwordHash },
      $setOnInsert: { _id: new ObjectId(), email, createdAt: new Date(), lastLoginAt: null },
    },
    { upsert: true },
  );
  // Clear any half-finished sign-up for this address so /register can't trip on it.
  await client.db(dbName).collection("email_otps").deleteOne({ email });

  console.log(
    `${result.upsertedCount ? "Created" : "Updated"} patient account in "${dbName}":\n` +
      `  email:    ${email}\n  name:     ${name}\n  Log in at /login.`,
  );
} catch (error) {
  console.error("Could not create the account:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
