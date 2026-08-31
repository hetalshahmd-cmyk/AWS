"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const CONSENT_COOKIE = "awsp_consent";
const SIX_MONTHS = 60 * 60 * 24 * 182;

type Consent = "granted" | "denied";

function readConsent(): Consent | null {
  const match = document.cookie.match(/(?:^|;\s*)awsp_consent=(granted|denied)/);
  return (match?.[1] as Consent | undefined) ?? null;
}

/**
 * The cookie is the source of truth, so it is read through
 * useSyncExternalStore rather than copied into state inside an effect. The
 * server snapshot is "unread", which renders nothing — that avoids both a
 * hydration mismatch and a banner flashing at visitors who already chose.
 */
let listeners: Array<() => void> = [];

function subscribe(onChange: () => void) {
  listeners.push(onChange);
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
  };
}

/**
 * Global Privacy Control and Do Not Track count as an opt-out, so the privacy
 * policy's promise to honour them is true rather than aspirational. These
 * visitors never see the notice either — they have already answered it.
 */
function signalsOptOut(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string;
  };
  if (nav.globalPrivacyControl === true) return true;
  const dnt = nav.doNotTrack ?? nav.msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

function getSnapshot(): Consent | null {
  if (signalsOptOut()) return "denied";
  return readConsent();
}

function getServerSnapshot(): "unread" {
  return "unread";
}

function writeConsent(value: Consent) {
  document.cookie = `${CONSENT_COOKIE}=${value};path=/;max-age=${SIX_MONTHS};samesite=lax`;
  for (const listener of listeners) listener();
}

/**
 * Meta pixel. Mounted unless the visitor has opted out, so the presence of the
 * script is itself the switch — there is no "loaded but disabled" state to get
 * wrong.
 */
function MetaPixel() {
  const pathname = usePathname();
  const mounted = useRef(false);

  // The base snippet below fires the first PageView. This covers every
  // client-side navigation after it, which would otherwise go uncounted
  // because App Router never reloads the document.
  //
  // usePathname only — deliberately not useSearchParams, which would opt the
  // entire app out of server rendering from the root layout down.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');
fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}

/**
 * A notice, not a gate. It tells the visitor what is already happening and
 * makes stopping it one click — the ordinary US pattern. Both buttons write
 * the same cookie, so the notice does not come back either way.
 */
function TrackingNotice({ onChoose }: { onChoose: (value: Consent) => void }) {
  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-mist bg-white shadow-[0_-8px_28px_-18px_rgba(44,32,38,0.45)]"
    >
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-[clamp(15px,4vw,40px)] py-4 min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between">
        <p className="max-w-[70ch] text-[0.95rem] text-plum-soft">
          We use cookies from Facebook to measure whether our ads help people find care.{" "}
          <strong className="text-plum">
            We never share your health information, your reason for visit, or your details.
          </strong>{" "}
          You can opt out, and the site works exactly the same.{" "}
          <Link href="/privacy" className="font-semibold text-wine link-underline">
            Read our privacy policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2.5 max-[480px]:flex-col">
          <button
            type="button"
            onClick={() => onChoose("denied")}
            className="focus-ring rounded-full border-[1.5px] border-wine px-5 py-2.5 text-[15px] font-semibold text-wine transition hover:bg-wine hover:text-white"
          >
            Opt out
          </button>
          <button
            type="button"
            onClick={() => onChoose("granted")}
            className="focus-ring rounded-full bg-wine px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-wine-deep"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Nothing here renders until NEXT_PUBLIC_META_PIXEL_ID is set, so an
 * unconfigured environment — local dev, CI, or the site before launch —
 * behaves exactly as it did before any of this existed.
 */
export default function Analytics() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const choose = useCallback((value: Consent) => writeConsent(value), []);

  if (!PIXEL_ID || consent === "unread") return null;

  // Measurement runs unless the visitor opts out, so someone who ignores the
  // notice is still counted — the opposite of a gate. The US has no cookie
  // opt-in requirement and Arizona no state privacy law, and nothing
  // health-derived is ever sent (see lib/meta.ts), so what is on by default
  // here is a page view and a click, never a condition.
  return (
    <>
      {consent !== "denied" && <MetaPixel />}
      {consent === null && <TrackingNotice onChoose={choose} />}
    </>
  );
}
