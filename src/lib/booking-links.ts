import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed links that let a patient manage one appointment without signing in —
 * the "Manage appointment" link in confirmation and reminder emails, and the
 * link a guest gets on the confirmation screen.
 *
 * The token is the booking id plus an HMAC of it, keyed with SESSION_SECRET.
 * It proves possession of the email, nothing more: it can view, cancel,
 * reschedule and check in for that one appointment, and it shows no medical
 * detail beyond what the patient entered.
 */

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set.");
  return value;
}

function sign(bookingId: string): string {
  return createHmac("sha256", `${secret()}:manage-appointment`)
    .update(bookingId)
    .digest("base64url")
    .slice(0, 32);
}

/** How long after the appointment its link keeps working. */
export const LINK_DAYS_AFTER_VISIT = 30;

/**
 * True once an appointment's link should stop working: 30 days after the
 * visit. The link is a bearer token in old emails and browser history, so it
 * must not open a patient's check-in answers forever.
 */
export function manageLinkExpired(appointmentDate: string, todayIso: string): boolean {
  const end = new Date(`${appointmentDate}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return true;
  end.setUTCDate(end.getUTCDate() + LINK_DAYS_AFTER_VISIT);
  return end.toISOString().slice(0, 10) < todayIso;
}

export function manageToken(bookingId: string): string {
  return `${bookingId}.${sign(bookingId)}`;
}

/** The booking id inside a valid token, or null. */
export function bookingIdFromToken(token: string): string | null {
  const [id, signature] = token.split(".");
  if (!id || !signature || !/^[a-f\d]{24}$/i.test(id)) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return id;
}

/** Absolute URL, for emails. */
export function siteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://arizonawomenspecialists.com").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

export function manageUrl(bookingId: string): string {
  return siteUrl(`/appointment/${manageToken(bookingId)}`);
}
