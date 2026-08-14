import { NextResponse } from "next/server";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { authenticateAdmin } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ session: await getSession() });
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
    const admin = await authenticateAdmin(email, password);
    if (!admin) {
      return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
    }
    await createSession(admin);
    return NextResponse.json({ admin });
  } catch (error) {
    console.error("sign in failed", error);
    return NextResponse.json({ error: "Could not reach the database" }, { status: 503 });
  }
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
