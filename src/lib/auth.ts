import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminById, getUserById, sessionVersionOf } from "./repo";
import type { Admin, User } from "./models";

const COOKIE = "aws_admin";
const USER_COOKIE = "aws_user";
const MAX_AGE = 60 * 60 * 8; // 8 hours
const USER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set.");
  // It signs every session and appointment link: a short one can be guessed.
  if (value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

type Kind = "admin" | "user";

/**
 * Cookie value: base64url(JSON) + "." + HMAC. The payload names its kind, so
 * a staff cookie can't be replayed as a patient one, and carries the account's
 * session version — bumped on a password change, which signs out every other
 * browser at once.
 */
async function issue(kind: Kind, account: { id: string; email: string }, maxAge: number): Promise<string> {
  const version = (await sessionVersionOf(kind, account.id)) ?? 0;
  const payload = Buffer.from(
    JSON.stringify({ typ: kind, id: account.id, email: account.email, v: version, expires: Date.now() + maxAge * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Signature, kind and expiry only — no database. */
function readCookie(raw: string | undefined, kind: Kind): { id: string; email: string; v: number } | null {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(sign(payload), signature)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      typ?: string;
      id?: string;
      email?: string;
      v?: number;
      expires?: number;
    };
    if (data.typ !== kind || !data.id || !data.email || !data.expires || data.expires < Date.now()) {
      return null;
    }
    return { id: data.id, email: data.email, v: typeof data.v === "number" ? data.v : 0 };
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export type Session = { id: string; email: string };

export async function createSession(admin: Pick<Admin, "id" | "email">): Promise<void> {
  const value = await issue("admin", admin, MAX_AGE);
  const jar = await cookies();
  jar.set(COOKIE, value, {
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
  const data = readCookie(jar.get(COOKIE)?.value, "admin");
  return data ? { id: data.id, email: data.email } : null;
}

/**
 * The signed-in staff account, read back from the database: a deleted
 * account, a changed password (session version) or a provider account with
 * no provider attached all count as signed out.
 */
export async function getCurrentAdmin(): Promise<Admin | null> {
  const jar = await cookies();
  const data = readCookie(jar.get(COOKIE)?.value, "admin");
  if (!data) return null;
  const [admin, version] = await Promise.all([getAdminById(data.id), sessionVersionOf("admin", data.id)]);
  if (!admin || (version ?? 0) !== data.v) return null;
  // Deny by default: a provider must be tied to a provider to see anything.
  if (admin.role === "provider" && !admin.providerId) return null;
  return admin;
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

export class ForbiddenError extends Error {
  constructor() {
    super("Your account can't do that");
    this.name = "ForbiddenError";
  }
}

/**
 * Any signed-in staff account (admin or provider), read back from the
 * database so a role change or a deleted account takes effect at once.
 */
export async function requireStaff(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new UnauthorizedError();
  return admin;
}

/**
 * For admin pages: the signed-in full admin, or a redirect — to the sign-in
 * page, or a provider to their own panel. Every admin page calls this itself
 * rather than relying on the (dash) layout alone: a layout doesn't re-run on
 * client navigation, and Next's docs warn against it as the only check.
 */
export async function requireAdminPage(): Promise<Admin> {
  const admin = await getCurrentAdmin().catch(() => null);
  if (!admin) redirect("/admin/login");
  if (admin.role !== "admin") redirect("/admin/doctor");
  return admin;
}

/** Only full admins — providers get a 403. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await requireStaff();
  if (admin.role !== "admin") throw new ForbiddenError();
  return admin;
}

/* ------------------------------------------------- patient (site) session -- */

export type UserSession = { id: string; email: string };

export async function createUserSession(user: Pick<User, "id" | "email">): Promise<void> {
  const value = await issue("user", user, USER_MAX_AGE);
  const jar = await cookies();
  jar.set(USER_COOKIE, value, {
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

/**
 * The signed-in patient. Checks the session version against the account, so
 * a password change (or a deleted account) signs every other browser out.
 */
export async function getUserSession(): Promise<UserSession | null> {
  const jar = await cookies();
  const data = readCookie(jar.get(USER_COOKIE)?.value, "user");
  if (!data) return null;
  const version = await sessionVersionOf("user", data.id);
  if (version === null || version !== data.v) return null;
  return { id: data.id, email: data.email };
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
