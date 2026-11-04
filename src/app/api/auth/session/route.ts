import { crossSiteBlocked } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { createSession, createUserSession, destroyUserSession, getCurrentUser, panelHome } from "@/lib/auth";
import { blockedByFailures, clientIp, fail } from "@/lib/rate-limit";
import { authenticateAdmin, authenticateUser, staffAccountExists } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** Who am I — the header calls this on load. */
export async function GET() {
  try {
    return NextResponse.json({ user: await getCurrentUser() });
  } catch {
    return NextResponse.json({ user: null });
  }
}

/**
 * The one sign-in for everybody, at /login. A staff email (admin or provider)
 * is checked against the staff account and gets the staff session and panel;
 * anyone else signs in as a patient. The two sessions stay separate cookies,
 * so a patient session is never a staff session.
 */
export async function POST(request: Request) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 120) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 256) : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Wrong passwords per address (guessing one patient's password) and per IP
  // (spraying many). Successful sign-ins don't count.
  const rules = [
    { key: `login:email:${email}`, limit: 10, windowSeconds: 900 },
    { key: `login:ip:${clientIp(request)}`, limit: 30, windowSeconds: 900 },
  ];
  // Staff accounts see every patient — tighter limits, the same ones the
  // staff sign-in API has always used.
  const staffRules = [
    { key: `staff-login:email:${email}`, limit: 5, windowSeconds: 900 },
    { key: `staff-login:ip:${clientIp(request)}`, limit: 20, windowSeconds: 900 },
  ];
  const blocked = await blockedByFailures(rules);
  if (blocked) return blocked;

  try {
    if (await staffAccountExists(email)) {
      const staffBlocked = await blockedByFailures(staffRules);
      if (staffBlocked) return staffBlocked;
      const admin = await authenticateAdmin(email, password);
      if (admin) {
        await createSession(admin);
        return NextResponse.json({
          staff: { role: admin.role },
          redirect: panelHome(admin.role),
        });
      }
      await fail(staffRules);
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      await fail(rules);
      return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
    }
    await createUserSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    console.error("sign in failed", error);
    return NextResponse.json({ error: "Could not reach the database" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  await destroyUserSession();
  return NextResponse.json({ ok: true });
}
