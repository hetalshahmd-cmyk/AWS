import { NextResponse } from "next/server";
import { mailConfigured, otpEmail, sendMail } from "@/lib/mail";
import { issueCode, OtpRateLimitError, verifyCode } from "@/lib/otp";
import { emailTaken } from "@/lib/repo";

export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** POST — send a code. */
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  try {
    if (await emailTaken(email)) {
      return NextResponse.json(
        { error: "That email already has an account — log in instead" },
        { status: 409 },
      );
    }

    const code = await issueCode(email);

    try {
      await sendMail({ to: email, ...otpEmail(code) });
    } catch (error) {
      console.error("Could not send the OTP email", error);

      // Without SMTP working there'd be no way to finish signing up, so in
      // development the code comes back in the response instead.
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[dev] verification code for ${email}: ${code}`);
        return NextResponse.json({
          sent: false,
          devCode: code,
          warning: mailConfigured
            ? "Email could not be sent — check the SMTP settings. Code returned for local testing."
            : "SMTP is not configured. Code returned for local testing.",
        });
      }
      return NextResponse.json(
        { error: "We couldn't send the code. Please try again or call the office." },
        { status: 502 },
      );
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      return NextResponse.json(
        { error: error.message, retryInSeconds: error.retryInSeconds },
        { status: 429 },
      );
    }
    console.error("otp send failed", error);
    return NextResponse.json({ error: "Could not send a code right now" }, { status: 503 });
  }
}

/** PUT — check a code. */
export async function PUT(request: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();

  if (!EMAIL.test(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  }

  try {
    const result = await verifyCode(email, code);
    switch (result) {
      case "ok":
        return NextResponse.json({ verified: true });
      case "expired":
        return NextResponse.json({ error: "That code expired — send a new one" }, { status: 410 });
      case "too-many":
        return NextResponse.json(
          { error: "Too many wrong tries — send a new code" },
          { status: 429 },
        );
      case "none":
        return NextResponse.json({ error: "Send a code first" }, { status: 400 });
      default:
        return NextResponse.json({ error: "That code isn't right" }, { status: 401 });
    }
  } catch (error) {
    console.error("otp verify failed", error);
    return NextResponse.json({ error: "Could not check the code" }, { status: 503 });
  }
}
