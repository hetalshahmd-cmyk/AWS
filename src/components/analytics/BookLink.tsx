"use client";

import Link from "next/link";
import { track } from "./track";

/**
 * Every "Book Now" on the site, reporting a Lead event on click.
 *
 * Lead counts people who set off to book. The booking itself is counted
 * separately as a Schedule event, fired only when /api/bookings confirms it
 * (see BookingFlowModal) — so Lead is intent and Schedule is the real thing.
 *
 * Our own booking page is a client-side navigation: the app stays loaded, so
 * the pixel call is not racing a page unload. An outside booking site (if the
 * booking URL is ever pointed at one again) opens in a new tab for the same
 * reason.
 */
export default function BookLink({
  href,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel} onClick={() => track("Lead")}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      aria-label={ariaLabel}
      onClick={() => track("Lead")}
    >
      {children}
    </a>
  );
}
