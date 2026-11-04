import type { MetadataRoute } from "next";

/** Public pages may be indexed; patient, staff and API paths may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/appointment", "/my-bookings", "/login", "/register", "/api"],
    },
    sitemap: `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://arizonawomenspecialists.com").replace(/\/+$/, "")}/sitemap.xml`,
  };
}
