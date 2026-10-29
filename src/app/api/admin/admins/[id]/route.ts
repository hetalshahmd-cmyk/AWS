import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/auth";
import { removeAdminAccount, resetAdminPassword, StaffInputError } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH { password } — set a new password for another admin. */
export const PATCH = adminRoute(async (request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const me = await requireAdmin();
  if (id === me.id) {
    return NextResponse.json({ error: "Change your own password under My account" }, { status: 400 });
  }
  const body = await readJson<{ password?: unknown }>(request);
  try {
    const admin = await resetAdminPassword(id, body.password);
    if (!admin) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StaffInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});

/** DELETE — remove another admin (never yourself, never the last one). */
export const DELETE = adminRoute(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const me = await requireAdmin();
  try {
    const removed = await removeAdminAccount(id, me.id);
    if (!removed) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StaffInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
