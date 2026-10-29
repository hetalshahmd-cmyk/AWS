import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page render.
 *
 * Next 16 renamed this convention from `middleware` to `proxy`; the export
 * name matters. Kept deliberately free of shared imports — proxy code can be
 * deployed to the CDN separately from the app, so the cookie name below is
 * repeated as a literal rather than imported from src/lib/meta.ts. If you
 * rename it there, rename it here.
 */

const CLICK_COOKIE = "awsp_fbclid";
const NINETY_DAYS = 60 * 60 * 24 * 90;

/**
 * Content-Security-Policy with a fresh nonce per page view. Only scripts that
 * carry the nonce (Next's own, and the Meta pixel snippet) run; anything
 * injected into a page does not. 'strict-dynamic' lets those trusted scripts
 * load what they need (the pixel loads connect.facebook.net). Inline style
 * attributes are allowed — a nonce can't cover them, and they can't run code.
 * Nonces need every page rendered per request (see app/layout.tsx).
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://www.facebook.com",
    "font-src 'self'",
    `connect-src 'self' https://www.facebook.com https://connect.facebook.net${dev ? " ws: wss:" : ""}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // One canonical hostname. Serving both www and the apex splits cookies and
  // ad attribution across two origins, so one visitor looks like two.
  if (host.toLowerCase().startsWith("www.")) {
    const target = new URL(request.url);
    target.host = host.slice(4);
    return NextResponse.redirect(target, 308);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  // Next reads the nonce from the request's CSP header and puts it on its own
  // scripts; x-nonce hands it to the layout for the pixel snippet.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // An ad click arrives with ?fbclid=... exactly once. Park it in a first-party
  // cookie, in Meta's own _fbc format, so a redirect, a consent banner or a
  // slow-loading pixel cannot lose it. Nothing is transmitted here — the value
  // only reaches Meta if the visitor accepts advertising cookies, which is the
  // promise /privacy makes.
  const fbclid = request.nextUrl.searchParams.get("fbclid");
  if (fbclid && !request.cookies.has(CLICK_COOKIE)) {
    response.cookies.set(CLICK_COOKIE, `fb.1.${Date.now()}.${fbclid}`, {
      maxAge: NINETY_DAYS,
      sameSite: "lax",
      path: "/",
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  // Without a matcher this runs on static files and image optimisation too.
  matcher: [
    // Not /api: the proxy only parks the ad click id, and running it on API
    // routes would buffer (and cap) request bodies such as check-in photos.
    "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|avif)$).*)",
  ],
};
