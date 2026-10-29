import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/analytics/Analytics";
import { SessionProvider } from "@/components/auth/session-context";
import ProvidersSync from "@/components/ProvidersSync";
import SiteContentSync from "@/components/SiteContentSync";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content";
import { DEFAULT_PROVIDERS } from "@/lib/providers";
import { loadProviders, loadSiteContent } from "@/lib/repo";
import { site } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/** Editorial serif for headings. Variable optical size keeps it crisp from 20px to 72px. */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

/** Absolute base for canonical URLs and social previews. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://arizonawomenspecialists.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${site.name} — Pregnancy & Women's Care in Phoenix & Glendale`,
    template: `%s`,
  },
  description: site.description,
  // No canonical here: it would be inherited by every page and tell search
  // engines they are all copies of the home page. Each page sets its own.
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    title: `${site.name} — Pregnancy & Women's Care in Phoenix & Glendale`,
    description: site.description,
    images: [{ url: "/logo2.png", width: 454, height: 200, alt: site.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — Pregnancy & Women's Care in Phoenix & Glendale`,
    description: site.description,
    images: ["/logo2.png"],
  },
  // Proves to Meta that we own this domain, which is what unlocks Aggregated
  // Event Measurement and stops anyone else claiming it. Rendered server-side
  // into <head> — Meta rejects the tag if JavaScript inserts it.
  verification: {
    other: {
      "facebook-domain-verification": "q88a0opy15vaa0ozidde2lgk5xzidj",
    },
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Providers come from the database (Admin → Doctors); the seed list if it is down.
  const providers = await loadProviders().catch(() => DEFAULT_PROVIDERS);
  // Hero and office details (Admin → Site content); the starting content if it is down.
  const content = await loadSiteContent().catch(() => DEFAULT_SITE_CONTENT);
  // The CSP nonce from src/proxy.ts. Reading request headers renders every
  // page per request, which nonces require.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-[17px] leading-[1.62]">
        <ProvidersSync list={providers} />
        <SiteContentSync content={content} />
        <SessionProvider>{children}</SessionProvider>
        <Analytics nonce={nonce} />
      </body>
    </html>
  );
}
