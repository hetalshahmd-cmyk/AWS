/**
 * Server-side Meta Conversions API.
 *
 * Two rules govern everything in this file, and neither is negotiable:
 *
 *  1. No health information ever leaves here. Not the reason for visit, not the
 *     service, not date of birth, sex, insurance, name, email or phone — and no
 *     internal user id either, because an id that only exists for people who
 *     booked at an OB-GYN is health-derived under Meta's Business Tools Terms
 *     §1.h. Events carry the fact that *something* happened and nothing else.
 *
 *  2. Nothing is sent unless the visitor allowed advertising cookies ("Allow"
 *     on the notice). That is the promise made on /privacy, kept here.
 *
 * Server-side delivery is not a way around either rule — a data source that
 * Meta restricts discards CAPI events the same as browser ones. Its value is
 * that the payload is built here, where it can be kept clean by construction.
 */

/** Public — inlined into the browser bundle. Same number as the dataset ID. */
export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

/** Secret. Server only. Never prefix this with NEXT_PUBLIC_. */
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN ?? "";

/**
 * Graph API versions are supported for roughly two years, then start failing.
 * Check developers.facebook.com/docs/graph-api/changelog and bump this — or
 * set META_GRAPH_VERSION in the environment to change it without a deploy.
 */
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

/** Set while testing so events land in Events Manager > Test Events. MUST be unset before launch. */
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE ?? "";

/** Consent cookie, written by the banner in components/analytics. */
export const CONSENT_COOKIE = "awsp_consent";
/** First-party copy of the ad click id, written by middleware. */
export const CLICK_COOKIE = "awsp_fbclid";

export const isMetaConfigured = Boolean(PIXEL_ID && ACCESS_TOKEN);

/** Event names we are willing to send. A closed list, on purpose. */
export type MetaEventName = "Schedule" | "CompleteRegistration" | "Lead" | "Contact";

function readCookies(request: Request): Record<string, string> {
  const header = request.headers.get("cookie");
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      out[part.slice(0, eq).trim()] = decodeURIComponent(raw);
    } catch {
      // A malformed cookie must never fail a booking or a sign-up.
      out[part.slice(0, eq).trim()] = raw;
    }
  }
  return out;
}

/**
 * The page an event came from, safe to give Meta: origin and path only — no
 * query string or hash, which can carry a provider, an office or a signed
 * appointment link — and just the home page for anything private.
 */
export function cleanSourceUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (/^\/(appointment|my-bookings|admin|login|register)(\/|$)/.test(url.pathname)) {
      return `${url.origin}/`;
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || undefined;
  return request.headers.get("x-real-ip") ?? undefined;
}

/**
 * Opt-in: only after the visitor chose "Allow". Must agree with the browser
 * notice in components/analytics, which loads the pixel on the same rule.
 *
 * Global Privacy Control and Do Not Track are honoured here as well as in the
 * browser, because a server event does not pass through the pixel.
 */
export function adTrackingAllowed(request: Request): boolean {
  if (request.headers.get("sec-gpc") === "1") return false;
  if (request.headers.get("dnt") === "1") return false;
  return readCookies(request)[CONSENT_COOKIE] === "granted";
}

type SendOptions = {
  /** Must match the eventID used by the browser pixel, or Meta counts it twice. */
  eventId: string;
  /** The page the visitor was on (e.g. the Referer). Reduced by cleanSourceUrl. */
  sourceUrl?: string;
};

/**
 * Fire-and-forget. Never throws, never blocks the response — a booking must
 * succeed whether or not Meta is reachable.
 */
export async function sendServerEvent(
  request: Request,
  eventName: MetaEventName,
  { eventId, sourceUrl }: SendOptions,
): Promise<void> {
  if (!isMetaConfigured) return;
  if (!adTrackingAllowed(request)) return;

  const cookies = readCookies(request);

  // Only browser-derived identifiers, all first-party, none health-derived.
  const userData: Record<string, string> = {};
  const ip = clientIp(request);
  const agent = request.headers.get("user-agent");
  if (ip) userData.client_ip_address = ip;
  if (agent) userData.client_user_agent = agent;
  if (cookies._fbp) userData.fbp = cookies._fbp;
  // Prefer Meta's own cookie; fall back to the copy middleware parked for us.
  const fbc = cookies._fbc || cookies[CLICK_COOKIE];
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        // Cleaned here, whatever the caller passed — see cleanSourceUrl.
        ...(cleanSourceUrl(sourceUrl) ? { event_source_url: cleanSourceUrl(sourceUrl) } : {}),
        user_data: userData,
        // Limited Data Use. 0/0 lets Meta geolocate and apply the right state
        // rules — the site serves visitors well beyond Arizona.
        data_processing_options: ["LDU"],
        data_processing_options_country: 0,
        data_processing_options_state: 0,
      },
    ],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  };

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Meta being slow must never hold up a patient's booking confirmation.
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      console.error("meta capi rejected", eventName, response.status, await response.text());
    }
  } catch (error) {
    console.error("meta capi failed", eventName, error);
  }
}
