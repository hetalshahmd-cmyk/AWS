import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { ensureIndexes, getDb } from "./db";
import type { EmailOtpDoc } from "./models";

const CODE_TTL_MS = 10 * 60 * 1000; // code is valid for 10 minutes
const VERIFIED_TTL_MS = 30 * 60 * 1000; // finish signing up within 30 minutes
const RESEND_GAP_MS = 45 * 1000;
const MAX_SENDS = 6;
const MAX_ATTEMPTS = 6;

async function otps() {
  await ensureIndexes();
  const db = await getDb();
  return db.collection<EmailOtpDoc>("email_otps");
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set.");
  return value;
}

/** Codes are stored only as an HMAC, under their own derived key. */
function hash(email: string, code: string): string {
  return createHmac("sha256", `${secret()}:otp`).update(`${email}:${code}`).digest("hex");
}

/**
 * Passing the code proves the inbox — but only for the browser that typed it.
 * A signed, HttpOnly cookie carries that proof, so someone else who knows the
 * address can't ride on the patient's verification to register or book.
 */
const VERIFIED_COOKIE = "aws_verified";

function signVerified(payload: string): string {
  return createHmac("sha256", `${secret()}:email-verified`).update(payload).digest("base64url");
}

async function rememberVerified(email: string): Promise<void> {
  const payload = Buffer.from(JSON.stringify({ email, expires: Date.now() + VERIFIED_TTL_MS })).toString(
    "base64url",
  );
  const jar = await cookies();
  jar.set(VERIFIED_COOKIE, `${payload}.${signVerified(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VERIFIED_TTL_MS / 1000,
  });
}

async function verifiedHere(email: string): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(VERIFIED_COOKIE)?.value;
  if (!raw) return false;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !safeEqual(signVerified(payload), signature)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      email?: string;
      expires?: number;
    };
    return data.email === email && typeof data.expires === "number" && data.expires > Date.now();
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export class OtpRateLimitError extends Error {
  constructor(public readonly retryInSeconds: number) {
    super(`Wait ${retryInSeconds}s before asking for another code`);
    this.name = "OtpRateLimitError";
  }
}

/** Creates (or refreshes) the code for an email and returns it for sending. */
export async function issueCode(email: string): Promise<string> {
  const collection = await otps();
  const now = new Date();
  const existing = await collection.findOne({ email });

  if (existing) {
    const since = now.getTime() - existing.lastSentAt.getTime();
    if (since < RESEND_GAP_MS) {
      throw new OtpRateLimitError(Math.ceil((RESEND_GAP_MS - since) / 1000));
    }
    if (existing.sends >= MAX_SENDS && existing.expiresAt > now) {
      throw new OtpRateLimitError(Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000));
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await collection.updateOne(
    { email },
    {
      $set: {
        codeHash: hash(email, code),
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
        attempts: 0,
        lastSentAt: now,
        verifiedAt: null,
      },
      $inc: { sends: 1 },
      $setOnInsert: { _id: new ObjectId(), email },
    },
    { upsert: true },
  );

  return code;
}

export type VerifyResult = "ok" | "expired" | "wrong" | "too-many" | "none";

export async function verifyCode(email: string, code: string): Promise<VerifyResult> {
  const collection = await otps();
  const now = new Date();
  // Claim one attempt atomically *before* comparing, so a burst of parallel
  // guesses can't all slip in under the limit.
  const doc = await collection.findOneAndUpdate(
    { email, expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!doc) {
    const current = await collection.findOne({ email });
    if (!current) return "none";
    if (current.expiresAt <= now) return "expired";
    return "too-many";
  }

  if (!safeEqual(doc.codeHash, hash(email, code))) return "wrong";

  // Single use: the code can't be replayed once it has worked.
  await collection.updateOne({ _id: doc._id }, { $set: { verifiedAt: now, codeHash: "" } });
  await rememberVerified(email);
  return "ok";
}

/**
 * True when this email passed OTP recently enough to finish registering or
 * booking — in this browser (see VERIFIED_COOKIE).
 */
export async function isEmailVerified(email: string): Promise<boolean> {
  const collection = await otps();
  const doc = await collection.findOne({ email });
  if (!doc?.verifiedAt) return false;
  if (Date.now() - doc.verifiedAt.getTime() >= VERIFIED_TTL_MS) return false;
  return verifiedHere(email);
}

export async function clearCode(email: string): Promise<void> {
  const collection = await otps();
  await collection.deleteOne({ email });
  const jar = await cookies();
  jar.delete(VERIFIED_COOKIE);
}
