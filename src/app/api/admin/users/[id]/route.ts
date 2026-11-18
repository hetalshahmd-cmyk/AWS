import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth";
import { archiveUserAccount, getUserDetail } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = adminRoute(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const detail = await getUserDetail(id);
  if (!detail) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  return NextResponse.json(detail);
});

/** "Delete patient" moves the account and its bookings to Admin → Archive. */
export const DELETE = adminRoute(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const admin = await requireAdmin();
  const result = await archiveUserAccount(id, admin.name || admin.email);
  if (!result) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  return NextResponse.json({ ok: true, archived: true, ...result });
});
