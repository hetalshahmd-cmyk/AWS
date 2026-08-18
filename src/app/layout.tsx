import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/analytics/Analytics";
import { SessionProvider } from "@/components/auth/session-context";
import { site } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
  alternates: { canonical: "/" },
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
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-[17px] leading-[1.62]">
        <SessionProvider>{children}</SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
