import { NextResponse } from "next/server";
import { readJson, staffRoute } from "@/lib/api-helpers";
import { sendConfirmation } from "@/lib/appointment-emails";
import { isLang } from "@/lib/i18n";
import {
  createBooking,
  getSlotInfo,
  hasStarted,
  listProviderBookings,
  markConfirmationSent,
  providersForReason,
  SlotUnavailableError,
  userIdByEmail,
} from "@/lib/repo";
import { isProviderId } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

const str = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** GET — a provider's own bookings (admins pass ?provider=). */
export const GET = staffRoute(async (request, staff) => {
  const asked = new URL(request.url).searchParams.get("provider");
  const providerId = staff.role === "provider" ? staff.providerId : asked;
  if (!isProviderId(providerId)) {
    return NextResponse.json({ error: "Pick a provider" }, { status: 400 });
  }
  return NextResponse.json({ bookings: await listProviderBookings(providerId) });
});

/**
 * POST — staff book a patient into an open time (phone, front desk, the
 * doctor's own panel). A provider can only use their own times. No email code
 * is needed — the staff member vouches for the patient — and the patient gets
 * the same confirmation email as an online booking. No ad conversion is sent:
 * this booking didn't come from an ad.
 */
export const POST = staffRoute(async (request, staff) => {
  const body = await readJson<Record<string, unknown>>(request);
  const slotId = str(body.slotId, 40);
  const patient = (body.patient ?? {}) as Record<string, unknown>;
  const email = str(patient.email, 120).toLowerCase();
  const firstName = str(patient.firstName, 60);
  const lastName = str(patient.lastName, 60);
  const dob = str(patient.dob, 20);
  const sex = str(patient.sex, 20);
  const reason = str(body.reason, 120) || "OB-GYN Consultation";

  if (!/^[a-f\d]{24}$/i.test(slotId)) {
    return NextResponse.json({ error: "Pick a time" }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName || !dob || !sex) {
    return NextResponse.json(
      { error: "Fill in the patient's name, email, date of birth and sex" },
      { status: 400 },
    );
  }

  const slot = await getSlotInfo(slotId);
  if (!slot) return NextResponse.json({ error: "That time no longer exists" }, { status: 404 });
  if (staff.role === "provider" && slot.providerId !== staff.providerId) {
    return NextResponse.json({ error: "You can only book your own times" }, { status: 403 });
  }
  if (hasStarted(slot)) {
    return NextResponse.json({ error: "That time has already passed" }, { status: 409 });
  }
  const allowed = await providersForReason(reason);
  if (allowed && slot.providerId && !allowed.includes(slot.providerId)) {
    return NextResponse.json(
      { error: "This provider doesn't take that visit reason (see Appointment slots → Visit reasons)" },
      { status: 409 },
    );
  }

  const insurance = body.insurance as { carrier?: unknown; plan?: unknown } | null;
  try {
    const booking = await createBooking({
      slotId,
      userId: await userIdByEmail(email),
      lang: isLang(body.lang) ? body.lang : "en",
      via: "staff",
      reason,
      patientType: body.patientType === "new" ? "new" : "existing",
      insurance:
        insurance && typeof insurance === "object" && str(insurance.carrier, 80)
          ? { carrier: str(insurance.carrier, 80), plan: str(insurance.plan, 80) }
          : null,
      patient: { email, firstName, lastName, dob, sex },
    });
    const emailed = await sendConfirmation(booking);
    if (emailed) await markConfirmationSent(booking.id).catch(() => undefined);
    return NextResponse.json({ booking, emailed }, { status: 201 });
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
});
