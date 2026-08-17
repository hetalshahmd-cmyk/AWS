import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api-helpers";
import { deleteUserAccount, getUserDetail } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = adminRoute(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const detail = await getUserDetail(id);
  if (!detail) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  return NextResponse.json(detail);
});

/** Deletes the account and its bookings, freeing any slots still held. */
export const DELETE = adminRoute(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const result = await deleteUserAccount(id);
  if (!result) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...result });
});
