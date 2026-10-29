import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendReminder } from "@/lib/appointment-emails";
import { addDays } from "@/lib/availability";
import { claimReminder, listReminderCandidates, type ReminderKey } from "@/lib/repo";
import { arizonaTodayIso } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

/**
 * Daily appointment reminders by email: 3 days before and 1 day before.
 *
 * Runs once a day (vercel.json schedules it). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused. Each
 * reminder is claimed in the database before it is sent, so a repeated or
 * overlapping run never emails a patient twice.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const PLAN: { key: ReminderKey; days: number }[] = [
  { key: "threeDay", days: 3 },
  { key: "oneDay", days: 1 },
];

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const today = arizonaTodayIso();
  const summary: Record<string, { due: number; sent: number; failed: number }> = {};

  for (const { key, days } of PLAN) {
    const due = await listReminderCandidates(addDays(today, days), key);
    let sent = 0;
    let failed = 0;
    for (const booking of due) {
      if (!(await claimReminder(booking.id, key))) continue;
      if (await sendReminder(booking, days)) sent += 1;
      else failed += 1;
    }
    summary[key] = { due: due.length, sent, failed };
  }

  return NextResponse.json({ date: today, ...summary });
}
