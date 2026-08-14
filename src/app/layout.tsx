import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} — Pregnancy & Women's Care in Phoenix & Glendale`,
    template: `%s`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    title: `${site.name} — Pregnancy & Women's Care in Phoenix & Glendale`,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-[17px] leading-[1.62]">
        {children}
      </body>
    </html>
  );
}
