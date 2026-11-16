"use client";

/**
 * Google tag (Google Analytics 4 + Google Ads conversion tracking).
 *
 * IDs from the practice's Google Ads account (azwspecialists@gmail.com, Nov
 * 2026). They are public — every page that carries the tag shows them — so
 * they live here with environment overrides rather than as secrets.
 *
 * Same rules as the Meta pixel: nothing loads until the visitor chooses
 * "Allow", never on private pages, and nothing about a patient is ever sent.
 * The one conversion we report is "a booking was confirmed" — no reason,
 * provider, office, date or patient detail.
 */
export const GOOGLE_TAG_ID = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || "G-64PBBQQR7N";
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-16664261388";
const GOOGLE_ADS_BOOKING_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL || "3HK4CJvF9NwcEIzmkYo-";

/**
 * Only the live site loads it, so test bookings on localhost, CI or a Vercel
 * preview can never be counted as ad conversions. A comma-separated
 * NEXT_PUBLIC_GOOGLE_TAG_HOSTS replaces the list (for a local check).
 */
const LIVE_HOSTS = (process.env.NEXT_PUBLIC_GOOGLE_TAG_HOSTS || "arizonawomenspecialists.com,www.arizonawomenspecialists.com")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

export function googleTagAllowedOn(hostname: string): boolean {
  return LIVE_HOSTS.includes(hostname.toLowerCase());
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Sets up gtag before gtag.js arrives (it reads the queue when it loads).
 * Ad personalisation and Google signals stay off: the tag measures whether
 * ads lead to bookings, and is never used to build audiences of patients.
 */
export function initGoogleTag(): void {
  if (typeof window === "undefined" || window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js expects the Arguments object itself, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  const gtag = window.gtag;
  gtag("consent", "default", {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "denied",
  });
  gtag("set", { allow_google_signals: false, allow_ad_personalization_signals: false });
  gtag("js", new Date());
  gtag("config", GOOGLE_TAG_ID);
  // No Ads page views (those feed remarketing lists) — conversions only.
  gtag("config", GOOGLE_ADS_ID, { send_page_view: false });
}

/** "A booking was confirmed" — the conversion the Google Ads account counts. */
export function reportBookingConversion(eventId?: string): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", "conversion", {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_BOOKING_LABEL}`,
      // The same id as the Meta event; Google counts a repeated id once.
      ...(eventId ? { transaction_id: eventId } : {}),
    });
  } catch {
    // Analytics must never break a booking.
  }
}
