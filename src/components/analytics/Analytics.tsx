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

function getSnapshot(): Consent | null {
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
 * Meta pixel. Mounted only once consent exists, so the script itself is the
 * consent gate — there is no "loaded but disabled" state to get wrong.
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

function ConsentBanner({ onChoose }: { onChoose: (value: Consent) => void }) {
  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-mist bg-white shadow-[0_-8px_28px_-18px_rgba(44,32,38,0.45)]"
    >
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-[clamp(15px,4vw,40px)] py-4 min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between">
        <p className="max-w-[70ch] text-[0.95rem] text-plum-soft">
          We use cookies from Facebook to see whether our ads help people find care.{" "}
          <strong className="text-plum">
            We never share your health information, your reason for visit, or your details.
          </strong>{" "}
          The site works exactly the same if you say no.{" "}
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
            No thanks
          </button>
          <button
            type="button"
            onClick={() => onChoose("granted")}
            className="focus-ring rounded-full bg-wine px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-wine-deep"
          >
            Allow
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
  if (consent === null) return <ConsentBanner onChoose={choose} />;

  return consent === "granted" ? <MetaPixel /> : null;
}
