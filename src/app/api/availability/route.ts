import { NextResponse } from "next/server";
import { getAvailability } from "@/lib/repo";
import { toIso } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? toIso(new Date());
  const days = Math.min(60, Math.max(1, Number(searchParams.get("days") ?? 14)));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }

  try {
    const days_ = await getAvailability(start, days);
    return NextResponse.json({ days: days_ });
  } catch (error) {
    console.error("availability failed", error);
    return NextResponse.json({ error: "Could not load availability" }, { status: 503 });
  }
}
