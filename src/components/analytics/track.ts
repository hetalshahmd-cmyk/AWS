"use client";

/**
 * Thin wrapper over the Meta pixel.
 *
 * Every call is a no-op unless the script actually loaded, which only happens
 * after the visitor accepts advertising cookies — so callers never have to
 * check consent themselves.
 *
 * Note the empty parameter object on every event. That is deliberate: no
 * reason for visit, no service name, no patient details, no user id. See
 * src/lib/meta.ts for why.
 */

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
  }
}

export type ClientEventName = "Schedule" | "CompleteRegistration" | "Lead" | "Contact";

/** Shared between the browser pixel and the server event, so Meta counts one. */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function track(name: ClientEventName, eventId?: string): void {
  if (typeof window === "undefined") return;
  const fbq = window.fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq("track", name, {}, eventId ? { eventID: eventId } : undefined);
  } catch {
    // Analytics must never break a booking.
  }
}
