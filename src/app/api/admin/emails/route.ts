import { NextResponse } from "next/server";
import { readJson, teamRoute } from "@/lib/api-helpers";
import { requireTeam } from "@/lib/auth";
import { EmailInputError, listPatientEmails, sendPatientEmail } from "@/lib/email-repo";
import { limited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET `?booking=` — emails sent to patients (for one booking, or the latest 100). */
export const GET = teamRoute(async (request) => {
  const booking = new URL(request.url).searchParams.get("booking");
  return NextResponse.json({ emails: await listPatientEmails(booking) });
});

/**
 * POST { bookingId, subject, message, template } — email the patient on that
 * booking. Admins and front desk only; the address comes from the booking.
 */
export const POST = teamRoute(async (request) => {
  const staff = await requireTeam();
  const blocked = await limited([{ key: `patient-email:${staff.id}`, limit: 60, windowSeconds: 3600 }], "That's a lot of emails in an hour — please wait a little.");
  if (blocked) return blocked;
  const body = await readJson<Record<string, unknown>>(request);
  try {
    const email = await sendPatientEmail(body, staff);
    if (!email) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (email.status === "failed") {
      return NextResponse.json({ error: "The email couldn't be sent — the mail server didn't accept it. It's noted in the email list.", email }, { status: 502 });
    }
    return NextResponse.json({ email }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
