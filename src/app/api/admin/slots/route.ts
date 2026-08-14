import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { createSlots, listSlots } from "@/lib/repo";
import { addDays, toIso } from "@/lib/availability";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const GET = adminRoute(async (request) => {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? toIso(new Date());
  const to = searchParams.get("to") ?? addDays(from, 27);
  return NextResponse.json({ slots: await listSlots(from, to) });
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
};

export const POST = adminRoute(async (request) => {
  const body = await readJson<Body>(request);

  const times = (body.times ?? [])
    .map((time) => time.trim())
    .filter((time) => /^\d{1,2}:\d{2}\s*(am|pm)$/i.test(time));

  if (times.length === 0) {
    return NextResponse.json({ error: "Add at least one valid time" }, { status: 400 });
  }

  let dates: string[] = [];

  if (Array.isArray(body.dates) && body.dates.length > 0) {
    dates = body.dates.filter((date) => ISO.test(date));
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

  const result = await createSlots({ dates, times, capacity: body.capacity });
  return NextResponse.json(result, { status: 201 });
});
