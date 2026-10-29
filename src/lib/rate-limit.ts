import { NextResponse } from "next/server";
import { ensureIndexes, getDb } from "./db";

/**
 * Fixed-window counters kept in MongoDB, so a limit holds across server
 * instances and restarts (an in-memory counter on serverless hosting would
 * reset with every cold start). Old windows are removed by a TTL index.
 */
type RateDoc = { _id: string; count: number; expiresAt: Date };

/**
 * The visitor's IP, from a source the visitor can't forge:
 *  - On Vercel, its edge sets x-forwarded-for itself (any value the client
 *    sent is replaced), so the first entry is the real address.
 *  - Behind your own proxy (nginx etc.) set TRUST_PROXY_HEADERS=1: the proxy
 *    appends the address it saw, so the *last* entry is the trusted one.
 *  - Otherwise the headers are ignored and everyone shares one bucket —
 *    strict, but never spoofable.
 */
export function clientIp(request: Request): string {
  const forwarded = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (process.env.VERCEL && forwarded[0]) return forwarded[0];
  if (process.env.TRUST_PROXY_HEADERS === "1" && forwarded.length) return forwarded[forwarded.length - 1];
  return "direct";
}

export type RateResult = { ok: boolean; retryInSeconds: number };

/**
 * Counts one hit for `key` and says whether it is still within `limit` per
 * `windowSeconds`. Atomic: concurrent requests each get their own count.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<RateResult> {
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection<RateDoc>("rate_limits");
  const now = new Date();
  const fresh = new Date(now.getTime() + windowSeconds * 1000);
  const update = [
    {
      $set: {
        // A window that has run out starts again at 1.
        count: { $cond: [{ $gt: ["$expiresAt", now] }, { $add: ["$count", 1] }, 1] },
        expiresAt: { $cond: [{ $gt: ["$expiresAt", now] }, "$expiresAt", fresh] },
      },
    },
  ];
  let doc: RateDoc | null = null;
  for (let attempt = 0; attempt < 2 && !doc; attempt += 1) {
    try {
      doc = await collection.findOneAndUpdate({ _id: key }, update, {
        upsert: true,
        returnDocument: "after",
      });
    } catch (error) {
      // Two first hits racing to create the same key: the loser retries.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  if (!doc) return { ok: true, retryInSeconds: 0 };
  const retryInSeconds = Math.max(1, Math.ceil((doc.expiresAt.getTime() - now.getTime()) / 1000));
  return { ok: doc.count <= limit, retryInSeconds };
}

type Rule = { key: string; limit: number; windowSeconds: number };

function tooMany(retryInSeconds: number, message: string): NextResponse {
  return NextResponse.json(
    { error: message, retryInSeconds },
    { status: 429, headers: { "Retry-After": String(retryInSeconds) } },
  );
}

/**
 * For counting failures only (e.g. wrong passwords): a 429 when any rule has
 * already reached its limit in the current window — without counting this
 * request. Pair with `fail()` after a failed attempt, so successful sign-ins
 * never use up the allowance.
 */
export async function blockedByFailures(
  rules: Rule[],
  message = "Too many wrong tries — please wait a few minutes and try again.",
): Promise<NextResponse | null> {
  await ensureIndexes();
  const db = await getDb();
  const docs = await db
    .collection<RateDoc>("rate_limits")
    .find({ _id: { $in: rules.map((rule) => rule.key) }, expiresAt: { $gt: new Date() } })
    .toArray();
  for (const doc of docs) {
    const rule = rules.find((item) => item.key === doc._id);
    if (rule && doc.count >= rule.limit) {
      return tooMany(Math.max(1, Math.ceil((doc.expiresAt.getTime() - Date.now()) / 1000)), message);
    }
  }
  return null;
}

/** Records one failed attempt against each rule. */
export async function fail(rules: Rule[]): Promise<void> {
  await Promise.all(rules.map((rule) => hit(rule.key, rule.limit, rule.windowSeconds)));
}

/**
 * Checks several limits at once (e.g. per IP and per email) and returns a 429
 * response for the first one that is exceeded, or null when all are fine.
 * Every limit is counted, so a blocked caller still uses up its window.
 */
export async function limited(
  rules: Rule[],
  message = "Too many tries — please wait a few minutes and try again.",
): Promise<NextResponse | null> {
  const results = await Promise.all(rules.map((rule) => hit(rule.key, rule.limit, rule.windowSeconds)));
  const blocked = results.find((result) => !result.ok);
  return blocked ? tooMany(blocked.retryInSeconds, message) : null;
}
