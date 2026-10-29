import { crossSiteBlocked } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { bookingCodeEmail } from "@/lib/appointment-emails";
import { isLang } from "@/lib/i18n";
import { accountExistsEmail, mailConfigured, otpEmail, sendMail } from "@/lib/mail";
import { issueCode, OtpRateLimitError, verifyCode } from "@/lib/otp";
import { clientIp, limited } from "@/lib/rate-limit";
import { emailTaken } from "@/lib/repo";

export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * POST — send a code. `purpose: "booking"` is the guest-booking check: it is
 * allowed for addresses that already have an account (the booking attaches to
 * it) and uses the appointment wording, in the patient's language.
 */
export async function POST(request: Request) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  let body: { email?: string; purpose?: string; lang?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 120) : "";
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  // Per address the code itself is limited (see issueCode); per IP this stops
  // one script mailing thousands of inboxes or burning the SMTP quota.
  const blocked = await limited([
    { key: `otp-send:ip:${clientIp(request)}`, limit: 15, windowSeconds: 3600 },
  ]);
  if (blocked) return blocked;

  const forBooking = body.purpose === "booking";
  const lang = isLang(body.lang) ? body.lang : "en";

  try {
    // Same answer whether or not the address has an account: telling the page
    // would let anyone check who is a patient here. The owner gets an email.
    if (!forBooking && (await emailTaken(email))) {
      await sendMail({ to: email, ...accountExistsEmail() }).catch((error) =>
        console.error("Could not send the account-exists email", (error as Error).message),
      );
      return NextResponse.json({ sent: true });
    }

    const code = await issueCode(email);

    try {
      await sendMail({ to: email, ...(forBooking ? bookingCodeEmail(code, lang) : otpEmail(code)) });
    } catch (error) {
      console.error("Could not send the OTP email", (error as Error).message);

      // Without SMTP working there'd be no way to finish signing up, so on a
      // developer's machine the code can come back in the response instead —
      // only when ALLOW_DEV_OTP=1 is set and never in a production build.
      if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_OTP === "1") {
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
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!EMAIL.test(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });
  }

  const blocked = await limited([
    { key: `otp-check:ip:${clientIp(request)}`, limit: 40, windowSeconds: 900 },
  ]);
  if (blocked) return blocked;

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
