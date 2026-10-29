import { NextResponse } from "next/server";
import { adminRoute, readJson } from "@/lib/api-helpers";
import { createSession, requireAdmin } from "@/lib/auth";
import { blockedByFailures, fail } from "@/lib/rate-limit";
import { StaffInputError, updateOwnAccount } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * PATCH — the signed-in admin's own account: { name }, and/or { email,
 * newPassword } with { currentPassword }. Changing the email or password signs
 * every other browser out; this one stays signed in.
 */
export const PATCH = adminRoute(async (request) => {
  const me = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(request);
  const rules = [{ key: `admin-account:${me.id}`, limit: 10, windowSeconds: 900 }];
  const blocked = await blockedByFailures(rules);
  if (blocked) return blocked;
  try {
    const account = await updateOwnAccount(me.id, body);
    await createSession(account);
    return NextResponse.json({ account });
  } catch (error) {
    if (error instanceof StaffInputError) {
      if (/current password/i.test(error.message)) await fail(rules);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
});
