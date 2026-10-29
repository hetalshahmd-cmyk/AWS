import { NextResponse } from "next/server";

/**
 * Cross-site request forgery guard for every route that changes something.
 *
 * Cookies are SameSite=Lax, which already stops another site's form or fetch
 * from carrying them on a POST — but a form can still *sign a visitor in* to
 * an account of the attacker's choosing (the response sets a cookie), and
 * Lax is only a browser default. So state-changing requests must come from
 * this site's own pages:
 *
 *  - Browsers send Sec-Fetch-Site; anything but same-origin (or "none", a
 *    typed URL or bookmark) is refused.
 *  - Older browsers send Origin on POST/PUT/PATCH/DELETE; it must name this
 *    host.
 *  - A request with neither header is not from a browser page (curl, a cron
 *    job, a server) and can't ride on a visitor's cookies, so it passes.
 */
export function crossSiteBlocked(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const site = request.headers.get("sec-fetch-site");
  if (site) {
    return site === "same-origin" || site === "none" ? null : refuse();
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return refuse();
  }
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.split(",")[0].trim());
  return hosts.includes(originHost) ? null : refuse();
}

function refuse(): NextResponse {
  return NextResponse.json({ error: "This request must come from the site itself." }, { status: 403 });
}
