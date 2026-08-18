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

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // One canonical hostname. Serving both www and the apex splits cookies and
  // ad attribution across two origins, so one visitor looks like two.
  if (host.toLowerCase().startsWith("www.")) {
    const target = new URL(request.url);
    target.host = host.slice(4);
    return NextResponse.redirect(target, 308);
  }

  const response = NextResponse.next();

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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|avif)$).*)",
  ],
};
