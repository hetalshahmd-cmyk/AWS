import { crossSiteBlocked } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { createUserSession } from "@/lib/auth";
import { sendServerEvent } from "@/lib/meta";
import { clearCode, isEmailVerified } from "@/lib/otp";
import { clientIp, limited } from "@/lib/rate-limit";
import { DuplicateUserError, registerUser } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = crossSiteBlocked(request);
  if (csrf) return csrf;
  let body: { name?: string; email?: string; password?: string; eventId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 120) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 256) {
    return NextResponse.json(
      { error: "Use a password of at least 8 characters" },
      { status: 400 },
    );
  }

  const blocked = await limited([
    { key: `register:ip:${clientIp(request)}`, limit: 10, windowSeconds: 3600 },
  ]);
  if (blocked) return blocked;

  try {
    // The address must have passed the emailed code — the client can't skip it
    // by posting straight to this route.
    if (!(await isEmailVerified(email))) {
      return NextResponse.json(
        { error: "Verify your email with the code we sent first", needsOtp: true },
        { status: 403 },
      );
    }

    const user = await registerUser({ name, email, password });
    await createUserSession(user);
    await clearCode(email);

    // Server-side truth for the account creation. Sent with no name, email or
    // user id — only the fact that a registration completed, tied to the
    // browser event by eventId so Meta counts one, not two.
    const eventId = typeof body.eventId === "string" ? body.eventId.trim().slice(0, 64) : "";
    if (eventId) {
      await sendServerEvent(request, "CompleteRegistration", {
        eventId,
        sourceUrl: request.headers.get("referer") ?? undefined,
      });
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateUserError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("register failed", error);
    return NextResponse.json({ error: "Could not create your account" }, { status: 503 });
  }
}
