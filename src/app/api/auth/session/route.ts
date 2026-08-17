import { NextResponse } from "next/server";
import { createUserSession, destroyUserSession, getCurrentUser } from "@/lib/auth";
import { authenticateUser } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** Who am I — the header calls this on load. */
export async function GET() {
  try {
    return NextResponse.json({ user: await getCurrentUser() });
  } catch {
    return NextResponse.json({ user: null });
  }
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
    }
    await createUserSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    console.error("sign in failed", error);
    return NextResponse.json({ error: "Could not reach the database" }, { status: 503 });
  }
}

export async function DELETE() {
  await destroyUserSession();
  return NextResponse.json({ ok: true });
}
