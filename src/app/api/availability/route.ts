import { NextResponse } from "next/server";
import { getAvailability, loadProviders, providersForReason } from "@/lib/repo";
import { getProviders } from "@/lib/providers";
import { arizonaTodayIso, isOfficeId, isProviderId } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? arizonaTodayIso();
  const officeId = searchParams.get("office");
  const providerId = searchParams.get("provider");
  const reason = searchParams.get("reason")?.slice(0, 120) ?? null;
  const days = Math.min(60, Math.max(1, Number(searchParams.get("days") ?? 14)));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }

  try {
    // Provider ids are checked against the current list (Admin → Doctors).
    await loadProviders();
    // Only providers shown on the site can be booked; a reason narrows it further.
    const visible = getProviders().map((provider) => provider.id);
    const forReason = await providersForReason(reason);
    const days_ = await getAvailability(start, days, {
      officeId: isOfficeId(officeId) ? officeId : null,
      providerId: isProviderId(providerId) ? providerId : null,
      allowedProviders: forReason ? forReason.filter((id) => visible.includes(id)) : visible,
    });
    return NextResponse.json({ days: days_ });
  } catch (error) {
    console.error("availability failed", error);
    return NextResponse.json({ error: "Could not load availability" }, { status: 503 });
  }
}
