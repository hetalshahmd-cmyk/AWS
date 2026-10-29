import { crossSiteBlocked } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { manageToken } from "@/lib/booking-links";
import { isLang } from "@/lib/i18n";
import { getProviders } from "@/lib/providers";
import { patientView } from "@/lib/models";
import { sendServerEvent } from "@/lib/meta";
import { isEmailVerified } from "@/lib/otp";
import { sendCancellation, sendConfirmation } from "@/lib/appointment-emails";
import { clientIp, limited } from "@/lib/rate-limit";
import {
  BookingInPastError,
  cancelBookingById,
  countUpcomingBookings,
  getBookingByToken,
  hasStarted,
  createBooking,
  getSlotProvider,
  markConfirmationSent,
  providersForReason,
  SlotUnavailableError,
  userIdByEmail,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

/** Upcoming confirmed visits one email address may hold at a time. */
const MAX_UPCOMING = 4;

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slotId = str(body.slotId, 40);
  const patient = (body.patient ?? {}) as Record<string, unknown>;
  const email = str(patient.email, 120);
  const firstName = str(patient.firstName, 60);
  const lastName = str(patient.lastName, 60);
  const dob = str(patient.dob, 20);
  const sex = str(patient.sex, 20);

  if (!/^[a-f\d]{24}$/i.test(slotId)) {
    return NextResponse.json({ error: "Pick an appointment time" }, { status: 400 });
  }
  if (!email.includes("@") || !firstName || !lastName || !dob || !sex) {
    return NextResponse.json({ error: "Please fill in every required field" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return NextResponse.json({ error: "Enter your date of birth" }, { status: 400 });
  }

  const insurance = body.insurance as { carrier?: unknown; plan?: unknown } | null;
  const reason = str(body.reason, 120) || "OB-GYN Consultation";

  const blocked = await limited([
    { key: `booking:ip:${clientIp(request)}`, limit: 20, windowSeconds: 3600 },
  ]);
  if (blocked) return blocked;

  // Who is booking: a signed-in patient, or a guest who has just proved the
  // email with a 6-digit code (POST /api/auth/otp with purpose "booking").
  // Either way nobody can book in someone else's name without their inbox.
  const session = await getUserSession();
  // A signed-in patient books as themselves: the confirmation (and its
  // manage link) only ever goes to the account's own, verified address.
  const normalisedEmail = session ? session.email.toLowerCase() : email.toLowerCase();
  if (!session && !(await isEmailVerified(normalisedEmail))) {
    return NextResponse.json(
      { error: "Confirm your email with the code we sent first", needsVerification: true },
      { status: 401 },
    );
  }

  // Rescheduling: the signed link of the visit being moved. It is checked
  // before anything is booked, and moved in the same request — the client no
  // longer books and cancels in two steps that could half-succeed.
  const rescheduleToken = str(body.reschedule, 120);
  let moving: Awaited<ReturnType<typeof getBookingByToken>> = null;
  if (rescheduleToken) {
    moving = await getBookingByToken(rescheduleToken).catch(() => null);
    if (!moving || moving.status !== "confirmed" || hasStarted(moving)) {
      return NextResponse.json(
        { error: "The appointment you were moving can't be changed any more. Please call the office." },
        { status: 410 },
      );
    }
  }

  // One person can't empty the calendar: a few upcoming visits per address.
  // The visit being moved doesn't count — it is about to be cancelled.
  const upcoming = (await countUpcomingBookings(normalisedEmail)) - (moving?.patient.email === normalisedEmail ? 1 : 0);
  if (upcoming >= MAX_UPCOMING) {
    return NextResponse.json(
      {
        error: `You already have ${MAX_UPCOMING} upcoming appointments. Please call the office to book more.`,
        code: "too-many-upcoming",
      },
      { status: 429 },
    );
  }

  // The provider on this slot must see patients for this visit reason.
  const allowed = await providersForReason(reason);
  const slotProvider = await getSlotProvider(slotId);
  // A provider hidden from the site (Admin → Doctors) can't be booked online.
  if (slotProvider && !getProviders().some((provider) => provider.id === slotProvider)) {
    return NextResponse.json(
      { error: "That provider isn't taking online bookings right now. Pick another time." },
      { status: 409 },
    );
  }
  if (allowed) {
    const provider = slotProvider;
    if (provider && !allowed.includes(provider)) {
      return NextResponse.json(
        { error: "That provider doesn't see patients for this visit reason. Pick another time." },
        { status: 409 },
      );
    }
  }

  try {
    const booking = await createBooking({
      slotId,
      userId: session?.id ?? (await userIdByEmail(normalisedEmail)),
      lang: isLang(body.lang) ? body.lang : "en",
      via: session ? "account" : "guest",
      reason,
      patientType: body.patientType === "new" ? "new" : "existing",
      insurance:
        insurance && typeof insurance === "object"
          ? { carrier: str(insurance.carrier, 80), plan: str(insurance.plan, 80) }
          : null,
      patient: {
        email: normalisedEmail,
        firstName,
        lastName,
        dob,
        sex,
        genderIdentity: str(patient.genderIdentity, 60) || undefined,
        pronouns: str(patient.pronouns, 40) || undefined,
      },
    });

    // Server-side truth: this is the only place a booking is provably real.
    // Deliberately sent with no reason, service, patient detail or user id —
    // just "a booking happened", tied to the browser event by eventId.
    const eventId = str(body.eventId, 64);
    if (eventId) {
      await sendServerEvent(request, "Schedule", {
        eventId,
        sourceUrl: request.headers.get("referer") ?? undefined,
      });
    }

    // Awaited so serverless hosting doesn't freeze the send mid-flight; it
    // never throws, so a mail outage can't fail the booking.
    const emailed = await sendConfirmation(booking);
    if (emailed) await markConfirmationSent(booking.id).catch(() => undefined);

    // The new time is held; now let the old one go. Cancelling is atomic, so a
    // double submit can't free the old seat twice.
    let moved: boolean | null = null;
    if (moving) {
      try {
        const result = await cancelBookingById(moving.id);
        moved = Boolean(result);
        if (result?.changed) await sendCancellation(result.booking);
      } catch (error) {
        moved = false;
        if (!(error instanceof BookingInPastError)) console.error("reschedule cancel failed", (error as Error).message);
      }
    }

    return NextResponse.json(
      { booking: patientView(booking), manageToken: manageToken(booking.id), emailed, moved },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("booking failed", error);
    return NextResponse.json({ error: "Could not save the booking" }, { status: 500 });
  }
}
