/**
 * Checks the environment this project needs: MongoDB and SMTP.
 *
 *   npm run doctor
 *
 * Reads .env.local through Next's loader. To test the *deployed* settings, copy
 * the host's env vars into a file and run:
 *   MONGODB_URI="..." SMTP_USER="..." SMTP_PASS="..." npm run doctor
 * (real env vars win over .env.local, exactly like the deployment).
 */
import "./load-env.mjs";
import { MongoClient } from "mongodb";
import nodemailer from "nodemailer";

const problems = [];

function mask(value) {
  if (!value) return "(not set)";
  if (value.length <= 6) return `${value[0]}***`;
  return `${value.slice(0, 3)}***${value.slice(-2)} (${value.length} chars)`;
}

console.log("Environment\n-----------");
for (const key of ["MONGODB_URI", "MONGODB_DB", "SESSION_SECRET", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_FROM"]) {
  const value = process.env[key] ?? "";
  const shown = key === "MONGODB_URI" ? value.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@") : value;
  console.log(`  ${key.padEnd(15)} ${shown || "(not set)"}`);
}
console.log(`  ${"SMTP_PASS".padEnd(15)} ${mask(process.env.SMTP_PASS)}`);
console.log(`  ${"SMTP_PASS_B64".padEnd(15)} ${process.env.SMTP_PASS_B64 ? "set" : "(not set)"}`);

const rawPass = process.env.SMTP_PASS ?? "";
if (/\\[$`"\\]/.test(rawPass)) {
  console.log(
    "\n  ! SMTP_PASS contains a backslash escape. That is correct in .env.local\n" +
      "    (Next expands $) but WRONG in a hosting dashboard, which stores values\n" +
      "    literally. In the dashboard use the raw password, or set SMTP_PASS_B64.",
  );
}

/* ------------------------------------------------------------- mongodb -- */

console.log("\nMongoDB\n-------");
if (!process.env.MONGODB_URI) {
  console.log("  ✗ MONGODB_URI is not set");
  problems.push("MONGODB_URI");
} else {
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  });
  const started = Date.now();
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? "arizona");
    await db.command({ ping: 1 });
    const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
    console.log(`  ✓ connected in ${Date.now() - started}ms`);
    console.log(`    collections: ${names.length ? names.join(", ") : "(none yet)"}`);
    for (const name of ["admins", "users", "bookings", "slots", "plans"]) {
      if (names.includes(name)) {
        console.log(`    ${name.padEnd(9)} ${await db.collection(name).countDocuments()} documents`);
      }
    }
  } catch (error) {
    console.log(`  ✗ ${error.message}`);
    if (/Server selection|ReplicaSetNoPrimary|ENOTFOUND/i.test(error.message)) {
      console.log(
        "    → Atlas: Network Access must allow the deployment's IPs.\n" +
          "      Add 0.0.0.0/0 for serverless hosting (Vercel, Netlify, Render…).\n" +
          "    → Check the user/password in the URI; percent-encode specials\n" +
          "      (@ = %40, : = %3A, / = %2F, ? = %3F, # = %23).",
      );
    }
    problems.push("MongoDB");
  } finally {
    await client.close().catch(() => {});
  }
}

/* ---------------------------------------------------------------- smtp -- */

console.log("\nSMTP\n----");
const user = process.env.SMTP_USER ?? "";
const secrets = [];
if (process.env.SMTP_PASS_B64) {
  secrets.push(["SMTP_PASS_B64", Buffer.from(process.env.SMTP_PASS_B64, "base64").toString("utf8")]);
}
secrets.push(["SMTP_PASS", rawPass]);
const unescaped = rawPass.replace(/\\(?=[$`"\\])/g, "");
if (unescaped !== rawPass) secrets.push(["SMTP_PASS un-escaped", unescaped]);

function candidates() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = (process.env.SMTP_SECURE ?? (port === 465 ? "true" : "false")) === "true";
  if (host) return [{ host, port, secure }];
  return [
    { host: "smtp.office365.com", port: 587, secure: false },
    { host: "smtpout.secureserver.net", port: 465, secure: true },
  ];
}

if (!user || !secrets.some(([, value]) => value)) {
  console.log("  ✗ SMTP_USER / SMTP_PASS are not set");
  problems.push("SMTP");
} else {
  let ok = false;
  for (const [label, secret] of secrets) {
    if (!secret || ok) continue;
    for (const candidate of candidates()) {
      const transporter = nodemailer.createTransport({
        ...candidate,
        auth: { user, pass: secret },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
      });
      process.stdout.write(`  ${candidate.host}:${candidate.port} with ${label}… `);
      try {
        await transporter.verify();
        console.log("OK");
        ok = true;
        transporter.close();
        break;
      } catch (error) {
        console.log(`failed — ${error.message}`);
        transporter.close();
      }
    }
  }
  if (!ok) {
    console.log(
      "\n  → 535 means the mailbox rejected the password. Check it is the raw\n" +
        "    password (no backslash), that Microsoft 365 has SMTP AUTH enabled for\n" +
        "    this mailbox, and that no conditional-access rule blocks the host's IPs.",
    );
    problems.push("SMTP");
  }
}

console.log(
  problems.length
    ? `\n✗ Problems with: ${problems.join(", ")}`
    : "\n✓ Everything the app needs is reachable.",
);
process.exitCode = problems.length ? 1 : 0;
