import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mailConfigured, passwordFingerprint, smtpCandidates, verifyMail } from "@/lib/mail";

export const dynamic = "force-dynamic";

/**
 * Deployment diagnostics: is MongoDB reachable, and is the SMTP password the
 * one we think it is? Guarded by a key rather than an admin session, because
 * admin sign-in needs MongoDB — which is exactly what may be broken.
 *
 *   curl -H "x-health-key: $HEALTH_KEY" https://<site>/api/admin/health
 *   …/api/admin/health?smtp=1     also attempts a real SMTP login
 *
 * The key is HEALTH_KEY only — never SESSION_SECRET, which signs every
 * session and appointment link — and only in a header, so it stays out of
 * request logs and browser history. Unset means the endpoint is off.
 */
function authorized(request: Request): boolean {
  const expected = process.env.HEALTH_KEY ?? "";
  if (expected.length < 16) return false;

  const provided = request.headers.get("x-health-key") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const checkSmtp = url.searchParams.get("smtp") === "1";

  const mongo: Record<string, unknown> = { configured: Boolean(process.env.MONGODB_URI) };
  const started = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    mongo.ok = true;
    mongo.ms = Date.now() - started;
    mongo.counts = {
      users: await db.collection("users").countDocuments(),
      bookings: await db.collection("bookings").countDocuments(),
      slots: await db.collection("slots").countDocuments(),
    };
  } catch (error) {
    mongo.ok = false;
    mongo.ms = Date.now() - started;
    mongo.error = error instanceof Error ? error.name : "unknown";
    mongo.hint =
      "Atlas → Network Access must allow this deployment's IPs (0.0.0.0/0 for serverless).";
  }

  const smtp: Record<string, unknown> = {
    configured: mailConfigured,
    user: process.env.SMTP_USER ?? "(not set)",
    from: process.env.SMTP_FROM ?? "(not set)",
    hosts: smtpCandidates().map((c) => `${c.host}:${c.port}${c.secure ? " ssl" : " starttls"}`),
    password: passwordFingerprint(),
  };

  if (checkSmtp) {
    try {
      const candidate = await verifyMail();
      smtp.loginOk = true;
      smtp.loggedInVia = `${candidate.host}:${candidate.port}`;
    } catch (error) {
      smtp.loginOk = false;
      const code = (error as { code?: string; responseCode?: number }) ?? {};
      smtp.error = [code.code, code.responseCode].filter(Boolean).join(" ") || "failed";
    }
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    mongo,
    smtp,
    // Compare `smtp.password.sha256` with the value from a machine where mail
    // works. Same fingerprint + failing login = the mail server is refusing
    // this host, not a wrong password.
  });
}
