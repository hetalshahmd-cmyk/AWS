import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { createSlots, listSlotBookings, listSlots } from "@/lib/repo";
import { addDays } from "@/lib/availability";
import { arizonaTodayIso, isOfficeId, isProviderId, normaliseTime } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const GET = adminRoute(async (request) => {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? arizonaTodayIso();
  const to = searchParams.get("to") ?? addDays(from, 27);
  const officeId = searchParams.get("office");
  const providerId = searchParams.get("provider");
  const [slots, bookedBy] = await Promise.all([
    listSlots(from, to, {
      officeId: isOfficeId(officeId) ? officeId : null,
      providerId: isProviderId(providerId) ? providerId : null,
    }),
    listSlotBookings(from, to),
  ]);
  return NextResponse.json({ slots, bookedBy });
});

type Body = {
  /** Explicit dates, or a from/to range with optional weekday filter. */
  dates?: string[];
  from?: string;
  to?: string;
  /** 0 = Sunday … 6 = Saturday. Empty/absent means every day in the range. */
  weekdays?: number[];
  times: string[];
  capacity?: number;
  providerId?: string;
  officeId?: string;
};

export const POST = adminRoute(async (request) => {
  const body = await readJson<Body>(request);

  if (!isProviderId(body.providerId)) {
    return NextResponse.json({ error: "Choose a provider" }, { status: 400 });
  }
  if (!isOfficeId(body.officeId)) {
    return NextResponse.json({ error: "Choose an office" }, { status: 400 });
  }

  // Bounded so one request can't create millions of slots.
  if (!Array.isArray(body.times) || body.times.length > 40) {
    return NextResponse.json({ error: "Add between 1 and 40 times" }, { status: 400 });
  }
  if (Array.isArray(body.dates) && body.dates.length > 120) {
    return NextResponse.json({ error: "Pick at most 120 dates at once" }, { status: 400 });
  }
  const capacity = Number(body.capacity ?? 1);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10) {
    return NextResponse.json({ error: "Capacity must be a whole number from 1 to 10" }, { status: 400 });
  }
  const times = body.times
    .map((time) => (typeof time === "string" ? normaliseTime(time) : null))
    .filter((time): time is string => time !== null);

  if (times.length === 0) {
    return NextResponse.json({ error: "Add at least one valid time" }, { status: 400 });
  }

  let dates: string[] = [];

  if (Array.isArray(body.dates) && body.dates.length > 0) {
    dates = body.dates.filter((date) => typeof date === "string" && ISO.test(date));
  } else if (body.from && body.to && ISO.test(body.from) && ISO.test(body.to)) {
    if (body.to < body.from) {
      return NextResponse.json({ error: "End date is before the start date" }, { status: 400 });
    }
    const weekdays = body.weekdays?.length ? new Set(body.weekdays) : null;
    for (let cursor = body.from, guard = 0; cursor <= body.to && guard < 180; guard += 1) {
      const day = new Date(`${cursor}T00:00:00Z`).getUTCDay();
      if (!weekdays || weekdays.has(day)) dates.push(cursor);
      cursor = addDays(cursor, 1);
    }
  }

  if (dates.length === 0) {
    return NextResponse.json({ error: "Pick at least one date" }, { status: 400 });
  }

  const result = await createSlots({
    dates,
    times,
    capacity,
    providerId: body.providerId,
    officeId: body.officeId,
  });
  return NextResponse.json(result, { status: 201 });
});
