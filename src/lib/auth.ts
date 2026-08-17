import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAdminById, getUserById } from "./repo";
import type { Admin, User } from "./models";

const COOKIE = "aws_admin";
const USER_COOKIE = "aws_user";
const MAX_AGE = 60 * 60 * 8; // 8 hours
const USER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set.");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export type Session = { id: string; email: string };

export async function createSession(admin: Pick<Admin, "id" | "email">): Promise<void> {
  const expires = Date.now() + MAX_AGE * 1000;
  // base64url so the payload never contains the "." separator — emails do.
  const payload = Buffer.from(
    JSON.stringify({ id: admin.id, email: admin.email, expires }),
  ).toString("base64url");

  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Reads and verifies the cookie. Does not hit the database. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(sign(payload), signature)) return null;

  try {
    const { id, email, expires } = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as { id?: string; email?: string; expires?: number };

    if (!id || !email || !expires || expires < Date.now()) return null;
    return { id, email };
  } catch {
    return null;
  }
}

/**
 * Like getSession, but confirms the account still exists — used by the admin
 * shell so a deleted admin is signed out on their next page load.
 */
export async function getCurrentAdmin(): Promise<Admin | null> {
  const session = await getSession();
  if (!session) return null;
  return getAdminById(session.id);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

/* ------------------------------------------------- patient (site) session -- */

export type UserSession = { id: string; email: string };

export async function createUserSession(user: Pick<User, "id" | "email">): Promise<void> {
  const expires = Date.now() + USER_MAX_AGE * 1000;
  const payload = Buffer.from(
    JSON.stringify({ id: user.id, email: user.email, expires }),
  ).toString("base64url");

  const jar = await cookies();
  jar.set(USER_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: USER_MAX_AGE,
  });
}

export async function destroyUserSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(USER_COOKIE);
}

export async function getUserSession(): Promise<UserSession | null> {
  const jar = await cookies();
  const raw = jar.get(USER_COOKIE)?.value;
  if (!raw) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(sign(payload), signature)) return null;

  try {
    const { id, email, expires } = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as { id?: string; email?: string; expires?: number };

    if (!id || !email || !expires || expires < Date.now()) return null;
    return { id, email };
  } catch {
    return null;
  }
}

/** Confirms the account still exists — used where the profile is displayed. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getUserSession();
  if (!session) return null;
  return getUserById(session.id);
}

export async function requireUserSession(): Promise<UserSession> {
  const session = await getUserSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
