import { crossSiteBlocked } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { createUserSession, getUserSession } from "@/lib/auth";
import { blockedByFailures, fail } from "@/lib/rate-limit";
import { changeUserPassword, updateUserName } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * PATCH — the signed-in patient updates their own account:
 *   { name }                        rename
 *   { currentPassword, newPassword } change password (current one required)
 */
export async function PATCH(request: Request) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  let body: { name?: unknown; currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.newPassword === "string") {
    // Guessing the current password through a stolen session is limited too.
    const rules = [{ key: `password-change:${session.id}`, limit: 10, windowSeconds: 900 }];
    const blocked = await blockedByFailures(rules);
    if (blocked) return blocked;
    if (body.newPassword.length < 8 || body.newPassword.length > 256) {
      return NextResponse.json({ error: "Use at least 8 characters" }, { status: 400 });
    }
    const result = await changeUserPassword(
      session.id,
      typeof body.currentPassword === "string" ? body.currentPassword : "",
      body.newPassword,
    );
    if (result === "wrong-password") {
      await fail(rules);
      return NextResponse.json(
        { error: "Your current password isn't right", code: "wrong-password" },
        { status: 400 },
      );
    }
    if (result === "not-found")
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    // Other browsers were just signed out; keep this one signed in.
    await createUserSession({ id: session.id, email: session.email });
    return NextResponse.json({ ok: true });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2) return NextResponse.json({ error: "Write your name" }, { status: 400 });
  const user = await updateUserName(session.id, name);
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  return NextResponse.json({ user });
}
