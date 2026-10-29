import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import {
  getMasterSchedule,
  getWeekSchedule,
  PastWeekError,
  saveMasterSchedule,
  saveWeekSchedule,
} from "@/lib/repo";
import { arizonaTodayIso, cleanSchedule } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?week=YYYY-MM-DD — that week's schedule (any day of the week works). */
export const GET = adminRoute(async (request) => {
  const week = new URL(request.url).searchParams.get("week") ?? arizonaTodayIso();
  if (!ISO.test(week)) return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  return NextResponse.json(await getWeekSchedule(week));
});

/**
 * PUT, one of:
 *   { week, rows }          this week only — its own schedule from now on
 *   { week, reset: true }   this week follows the fixed schedule again
 *   { master: true, rows }  the fixed weekly schedule, applied to every
 *                           upcoming week that follows it
 * Slots follow at once; booked times are never removed. An empty `rows`
 * closes the week (or, for the fixed schedule, every following week).
 */
export const PUT = adminRoute(async (request) => {
  const body = await readJson<{ week?: string; rows?: unknown; reset?: boolean; master?: boolean }>(
    request,
  );

  if (body.reset) {
    if (!body.week || !ISO.test(body.week)) {
      return NextResponse.json({ error: "Pick a week" }, { status: 400 });
    }
    return save(() =>
      getMasterSchedule().then((rows) => saveWeekSchedule(body.week!, rows, { custom: false })),
    );
  }

  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }
  const rows = cleanSchedule(body.rows);
  if (rows.length < body.rows.length) {
    return NextResponse.json(
      { error: "Every provider needs at least one time, written like 8:30 am" },
      { status: 400 },
    );
  }

  if (body.master) return save(() => saveMasterSchedule(rows));

  if (!body.week || !ISO.test(body.week)) {
    return NextResponse.json({ error: "Pick a week" }, { status: 400 });
  }
  return save(() => saveWeekSchedule(body.week!, rows, { custom: true }));
});

async function save(run: () => Promise<unknown>) {
  try {
    const result = await run();
    // Opening times across the site come from the week plan — refresh them now.
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PastWeekError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
