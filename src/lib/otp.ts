import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
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

function hash(email: string, code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
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
  const doc = await collection.findOne({ email });
  if (!doc) return "none";
  if (doc.expiresAt < new Date()) return "expired";
  if (doc.attempts >= MAX_ATTEMPTS) return "too-many";

  if (!safeEqual(doc.codeHash, hash(email, code))) {
    await collection.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
    return "wrong";
  }

  await collection.updateOne({ _id: doc._id }, { $set: { verifiedAt: new Date() } });
  return "ok";
}

/** True when this email passed OTP recently enough to finish registering. */
export async function isEmailVerified(email: string): Promise<boolean> {
  const collection = await otps();
  const doc = await collection.findOne({ email });
  if (!doc?.verifiedAt) return false;
  return Date.now() - doc.verifiedAt.getTime() < VERIFIED_TTL_MS;
}

export async function clearCode(email: string): Promise<void> {
  const collection = await otps();
  await collection.deleteOne({ email });
}
