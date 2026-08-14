import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { deleteSlot, setSlotActive } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = adminRoute(async (request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await readJson<{ active?: boolean }>(request);

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const slot = await setSlotActive(id, body.active);
  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  return NextResponse.json({ slot });
});

export const DELETE = adminRoute(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const ok = await deleteSlot(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Slot not found, or it already has a booking" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
});
