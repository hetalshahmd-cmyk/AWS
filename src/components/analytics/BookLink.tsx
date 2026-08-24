"use client";

import { track } from "./track";

/**
 * A link out to the practice's booking page, reporting a Lead event.
 *
 * Worth being honest about what this measures: booking happens on healow.com,
 * which is eClinicalWorks' domain and carries none of our instrumentation. So
 * this counts people who set off to book — not people who booked. Someone who
 * lands on Healow and abandons looks identical here to someone who keeps the
 * appointment. Measuring real bookings would need a pixel on the Healow page,
 * which only eClinicalWorks can grant.
 *
 * The link opens in a new tab, so the pixel request is not racing a page
 * unload — no sendBeacon gymnastics needed.
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
