import type { NextConfig } from "next";

/**
 * Sent with every response: no framing (clickjacking on login, booking and
 * the admin panel), no MIME sniffing, and only the origin — never a path that
 * may hold an appointment link — in the Referer sent to other sites. The
 * page Content-Security-Policy, with its per-request nonce, is set in
 * src/proxy.ts.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // Browsers ignore this over plain http, so it is harmless in development.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** Pages about one patient or for staff: never indexed by search engines. */
const privatePaths = [
  "/admin/:path*",
  "/appointment/:path*",
  "/my-bookings/:path*",
  "/my-bookings",
  "/login",
  "/register",
  "/api/:path*",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...privatePaths.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
