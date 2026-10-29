import { crossSiteBlocked } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { blockedByFailures, clientIp, fail } from "@/lib/rate-limit";
import { authenticateAdmin } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ session: await getSession() });
}

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

  // Staff accounts see every patient — tighter than the patient login. Only
  // wrong passwords count.
  const rules = [
    { key: `staff-login:email:${email}`, limit: 5, windowSeconds: 900 },
    { key: `staff-login:ip:${clientIp(request)}`, limit: 20, windowSeconds: 900 },
  ];
  const blocked = await blockedByFailures(rules);
  if (blocked) return blocked;

  try {
    const admin = await authenticateAdmin(email, password);
    if (!admin) {
      await fail(rules);
      return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
    }
    await createSession(admin);
    return NextResponse.json({ admin });
  } catch (error) {
    console.error("sign in failed", error);
    return NextResponse.json({ error: "Could not reach the database" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  await destroySession();
  return NextResponse.json({ ok: true });
}
