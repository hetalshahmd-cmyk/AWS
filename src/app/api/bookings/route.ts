import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { sendServerEvent } from "@/lib/meta";
import { createBooking, SlotUnavailableError } from "@/lib/repo";

export const dynamic = "force-dynamic";

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
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

  const insurance = body.insurance as { carrier?: unknown; plan?: unknown } | null;

  // Booking requires an account — the page redirects, and this stops anyone
  // posting straight to the API.
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "Log in to book an appointment", needsLogin: true },
      { status: 401 },
    );
  }

  try {
    const booking = await createBooking({
      slotId,
      userId: session.id,
      reason: str(body.reason, 120) || "OB-GYN Consultation",
      patientType: body.patientType === "new" ? "new" : "existing",
      insurance:
        insurance && typeof insurance === "object"
          ? { carrier: str(insurance.carrier, 80), plan: str(insurance.plan, 80) }
          : null,
      patient: {
        email,
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

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("booking failed", error);
    return NextResponse.json({ error: "Could not save the booking" }, { status: 500 });
  }
}
