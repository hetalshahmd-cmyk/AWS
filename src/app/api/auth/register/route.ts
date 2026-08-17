import { NextResponse } from "next/server";
import { createUserSession } from "@/lib/auth";
import { clearCode, isEmailVerified } from "@/lib/otp";
import { DuplicateUserError, registerUser } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim().slice(0, 80);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 120);
  const password = body.password ?? "";

  if (!name) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use a password of at least 8 characters" },
      { status: 400 },
    );
  }

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
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateUserError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("register failed", error);
    return NextResponse.json({ error: "Could not create your account" }, { status: 503 });
  }
}
