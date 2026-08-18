"use client";

import { track } from "./track";

/**
 * A `tel:` link that reports a Contact event.
 *
 * Worth being honest about what this measures: it counts taps on the number,
 * not answered calls. A misdial, a hang-up and a booked appointment all look
 * identical here. Real call measurement needs a tracking number with dynamic
 * number insertion — and any vendor that records or transcribes patient calls
 * handles PHI and must sign a BAA first.
 */
export default function PhoneLink({
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
      className={className}
      aria-label={ariaLabel}
      onClick={() => track("Contact")}
    >
      {children}
    </a>
  );
}
