import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { removeProviderLogin, setProviderLogin, StaffInputError } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT { email, password? } — create the provider's sign-in, or change its
 * email and/or password. A new password signs them out everywhere.
 */
export const PUT = adminRoute(async (request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await readJson<{ email?: unknown; password?: unknown }>(request);
  try {
    const account = await setProviderLogin(id, body);
    return NextResponse.json({ email: account.email });
  } catch (error) {
    if (error instanceof StaffInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
});

/** DELETE — remove the sign-in. The profile and bookings stay. */
export const DELETE = adminRoute(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const removed = await removeProviderLogin(id);
  if (!removed) return NextResponse.json({ error: "This provider has no sign-in" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
