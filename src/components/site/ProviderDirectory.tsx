"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/auth/session-context";
import { useBooking } from "@/components/booking-context";
import { track } from "@/components/analytics/track";
import { isOfficeId } from "@/lib/scheduling";
import { site } from "@/lib/site";
import { getOffices } from "@/lib/site-content";
import { getProviders, type Provider, zocdocReviewsHref } from "@/lib/providers";
import Ico from "./Ico";
import ProviderAvatar from "./ProviderAvatar";
import ZocdocReviews from "./ZocdocReviews";


const BOOK =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-wine px-5 text-[15px] font-medium text-white shadow-[0_10px_24px_-14px_rgba(124,44,62,.9)] transition hover:bg-wine-deep";
const LINE =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-mist bg-white px-5 text-[15px] font-medium text-plum transition hover:border-plum/40 hover:bg-ivory";
const LABEL = "text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-stone";
const CHAT =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#00a884]/40 bg-white px-5 text-[15px] font-medium text-[#008069] transition hover:border-[#00a884] hover:bg-[#e7fce3]";


/**
 * The provider cards on the Providers page: a short card each, the full
 * profile in a popup, and Book opening that provider's booking form right
 * here — office, times, visit details — without leaving the page.
 *
 *   /about#provider-tate        opens Kylee's profile
 *   /about#book-tate            opens Kylee's booking form
 *   /about#book-tate-arrowhead  …at the Glendale office
 */
export default function ProviderDirectory() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<Provider | null>(null);
  const { setProviderId, setOfficeId, openBooking } = useBooking();

  function show(provider: Provider) {
    setOpen(provider);
    dialog.current?.showModal();
  }

  function book(provider: Provider, office?: string, counted = true) {
    // The profile popup sits in the top layer; close it so the form shows.
    dialog.current?.close();
    if (counted) track("Lead");
    setProviderId(provider.id);
    setOfficeId(isOfficeId(office) ? office : "any");
    openBooking(null);
  }

  // #provider-<id> opens a profile; #book-<id>[-<office>] opens booking.
  useEffect(() => {
    function fromHash() {
      const hash = window.location.hash.slice(1);
      const profile = getProviders().find((p) => hash === `provider-${p.id}`);
      if (profile) {
        // Switch to this provider even if another profile is already open.
        setOpen(profile);
        if (!dialog.current?.open) dialog.current?.showModal();
        return;
      }
      const [, id, office] = hash.match(/^book-([a-z]+)(?:-([a-z]+))?$/) ?? [];
      const provider = getProviders().find((p) => p.id === id);
      if (provider && !provider.bookable) {
        // No online booking for this provider: show their profile, which says who to see first.
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}#provider-${provider.id}`);
        setOpen(provider);
        if (!dialog.current?.open) dialog.current?.showModal();
      } else if (provider) {
        // The Book link that brought them here already counted the Lead.
        book(provider, office, false);
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // Runs once on arrival and on later hash changes; `book` only uses setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ul className="grid gap-5 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3">
        {getProviders().map((provider) => (
          <li key={provider.id} id={`provider-${provider.id}`} className="scroll-mt-28">
            <ProviderCard
              provider={provider}
              onOpen={() => show(provider)}
              onBook={() => book(provider)}
            />
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-labelledby="provider-dialog-title"
        onClose={() => {
          setOpen(null);
          if (window.location.hash.startsWith("#provider-")) {
            history.replaceState(null, "", window.location.pathname + window.location.search);
          }
        }}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto max-h-[min(92vh,900px)] w-[min(880px,calc(100vw-24px))] overflow-hidden rounded-[28px] border border-mist bg-white p-0 text-plum shadow-[0_30px_80px_-24px_rgba(44,32,38,.55)] backdrop:bg-plum/50 backdrop:backdrop-blur-[2px]"
      >
        {open && (
          <ProviderProfile
            key={open.id}
            provider={open}
            onClose={() => dialog.current?.close()}
            onBook={() => book(open)}
          />
        )}
      </dialog>
    </>
  );
}

/* -------------------------------------------------------------- card -- */

function ProviderCard({
  provider,
  onOpen,
  onBook,
}: {
  provider: Provider;
  onOpen: () => void;
  onBook: () => void;
}) {
  const focus: readonly string[] = provider.focus;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-mist bg-white transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className={`relative h-24 bg-linear-to-br ${provider.avatar}`}>
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,.28),transparent_55%)]"
        />
        <span
          className={`absolute right-4 top-4 inline-flex max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[0.74rem] font-medium ${
            provider.badge ? "text-plum" : "text-sage-ink"
          }`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${provider.badge ? "bg-wine" : "bg-sage"}`} aria-hidden="true" />
          {provider.badge ?? "Accepting new patients"}
        </span>
        <div className="absolute -bottom-12 left-6">
          <ProviderAvatar provider={provider} size="md" />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-16">
        <h3 className="font-display text-[1.5rem] leading-tight text-plum">{provider.name}</h3>
        <p className="mt-1 text-[0.92rem] font-medium text-sage-ink">{provider.cred}</p>
        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
          <ZocdocReviews count={provider.zocdocReviews} rating={provider.zocdocRating} />
          <span className="inline-flex items-center gap-1.5 text-[0.82rem] text-plum-soft">
            <Ico name="globe" className="h-3.5 w-3.5" />
            {provider.languages.join(", ")}
          </span>
        </div>

        <p className="mt-4 line-clamp-3 text-[0.95rem] leading-relaxed text-plum-soft">
          {provider.about[0]}
        </p>
        {provider.newPatientNote && <NewPatientNote text={provider.newPatientNote} className="mt-3" />}

        {focus.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {focus.slice(0, 3).map((reason) => (
              <li
                key={reason}
                className="rounded-full border border-mist bg-ivory px-2.5 py-0.5 text-[0.8rem] text-plum"
              >
                {reason}
              </li>
            ))}
            {focus.length > 3 && (
              <li className="rounded-full px-1.5 py-0.5 text-[0.8rem] text-plum-soft">
                +{focus.length - 3} more
              </li>
            )}
          </ul>
        )}

        <div className={`mt-auto grid gap-2 pt-6 ${provider.bookable ? "grid-cols-2" : "grid-cols-1"}`}>
          <button type="button" onClick={onOpen} className={LINE} aria-haspopup="dialog">
            View profile
          </button>
          {provider.bookable && (
            <button type="button" onClick={onBook} className={BOOK} aria-haspopup="dialog">
              <Ico name="cal" className="h-4 w-4" />
              Book
            </button>
          )}
          {canChat(provider) && <ChatLink provider={provider} className={`${CHAT} ${provider.bookable ? "col-span-2" : ""}`} />}
        </div>
      </div>
    </article>
  );
}

/* ----------------------------------------------------------- profile -- */

function ProviderProfile({
  provider,
  onClose,
  onBook,
}: {
  provider: Provider;
  onClose: () => void;
  onBook: () => void;
}) {
  const focus: readonly string[] = provider.focus;
  const certifications: readonly string[] = provider.certifications;
  return (
    <div className="flex max-h-[min(92vh,900px)] flex-col">
      {/* ------------------------------------------------------ header -- */}
      <div className={`relative shrink-0 bg-linear-to-br ${provider.avatar} px-5 py-5 text-white sm:px-8 sm:py-6`}>
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,.25),transparent_55%)]"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="focus-ring absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
        >
          <Ico name="close" className="h-5 w-5" />
        </button>
        <div className="relative flex items-start gap-4 pr-10 sm:items-center sm:gap-5">
          <span className="sm:hidden">
            <ProviderAvatar provider={provider} size="sm" />
          </span>
          <span className="hidden sm:block">
            <ProviderAvatar provider={provider} size="md" />
          </span>
          <div className="min-w-0">
            <h2 id="provider-dialog-title" className="font-display text-[clamp(1.35rem,4vw,2.1rem)] leading-tight">
              {provider.name}
            </h2>
            <p className="mt-0.5 text-[0.98rem] text-white/85">{provider.cred}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {provider.zocdocReviews ? (
                <a
                  href={zocdocReviewsHref(provider)}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-1 text-[0.82rem] text-plum transition hover:bg-ivory"
                >
                  <Ico name="star" className="h-3.5 w-3.5 fill-current text-[#E0607E]" />
                  {provider.zocdocRating !== null && (
                    <span className="font-semibold">{provider.zocdocRating.toFixed(2)}</span>
                  )}
                  <span className="text-plum-soft">
                    · {provider.zocdocReviews} reviews<span className="hidden sm:inline"> on Zocdoc</span>
                  </span>
                </a>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[0.82rem]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
                {provider.badge ?? "Accepting new patients"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------- body -- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 sm:px-8">
        <p className={LABEL}>About</p>
        <div className="mt-3 space-y-3 text-[1rem] leading-relaxed text-plum-soft">
          {provider.about.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {provider.newPatientNote && <NewPatientNote text={provider.newPatientNote} className="mt-4" />}

        <dl className="mt-7 grid gap-x-8 gap-y-6 border-t border-mist pt-6 sm:grid-cols-2">
          <Fact icon="star" label="Education & training">
            <ul className="space-y-1.5">
              {provider.education.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Fact>
          {certifications.length > 0 && (
            <Fact icon="shield" label="Board certification">
              <ul className="space-y-1.5">
                {certifications.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Fact>
          )}
          <Fact icon="globe" label="Languages">
            {provider.languages.join(", ")}
          </Fact>
          <Fact icon="pin" label="Offices">
            <ul className="space-y-1.5">
              {getOffices().map((office) => (
                <li key={office.id}>
                  <span className="font-medium">{office.name}</span>
                  <span className="block text-[0.86rem] text-plum-soft">
                    {office.address.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </Fact>
          <Fact icon="tag" label="NPI">
            {provider.npi}
          </Fact>
        </dl>

        {focus.length > 0 && (
          <div className="mt-7 border-t border-mist pt-6">
            <p className={LABEL}>Patients often book for</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {focus.map((reason) => (
                <li
                  key={reason}
                  className="rounded-full border border-mist bg-ivory px-3 py-1 text-[0.86rem] text-plum"
                >
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ footer -- */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-mist bg-ivory px-6 py-4 sm:px-8">
        {/* This provider's own listings elsewhere, side by side. */}
        <div className="flex flex-wrap gap-2 max-sm:w-full">
          {provider.zocdocUrl && (
            <ListingLink href={provider.zocdocUrl} label={`${provider.name} on Zocdoc`}>
              Zocdoc
            </ListingLink>
          )}
          <EcwButton provider={provider} />
        </div>
        <div className="flex flex-wrap gap-2 max-sm:w-full">
          {canChat(provider) && <ChatLink provider={provider} className={`${CHAT} max-sm:flex-1`} />}
          {provider.bookable && (
            <button type="button" onClick={onBook} className={`${BOOK} max-sm:flex-1`}>
              <Ico name="cal" className="h-4 w-4" />
              {provider.cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shown with a Chat button: chat on, and the provider can sign in to answer. */
const canChat = (provider: Provider) => provider.chatEnabled && provider.hasLogin;

/**
 * Chat with this provider: straight into the patient's messages, or through
 * sign-in first (chats are private, so they need an account).
 */
function ChatLink({ provider, className }: { provider: Provider; className: string }) {
  const { user } = useSession();
  const target = `/my-bookings/messages?provider=${provider.id}`;
  const first = provider.name.replace(/^Dr\.?\s+/i, "Dr. ").split(",")[0];
  return (
    <Link href={user ? target : `/login?next=${encodeURIComponent(target)}`} className={className} aria-label={`Chat with ${first}`}>
      <Ico name="mail" className="h-4 w-4" />
      Chat
    </Link>
  );
}

/** Who new patients see first, under the description. */
function NewPatientNote({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`flex gap-2 rounded-xl bg-wine-soft/60 px-3 py-2.5 text-[0.88rem] leading-snug text-plum ${className}`}>
      <Ico name="users" className="mt-0.5 h-4 w-4 shrink-0 text-wine" />
      <span>{text}</span>
    </p>
  );
}

const LISTING =
  "focus-ring inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-mist bg-white px-4 text-[0.9rem] font-medium text-plum transition hover:border-plum/40 max-sm:flex-1 max-sm:justify-center";

/**
 * The provider's eClinicalWorks (healow) booking page. Until that link is
 * set in lib/site.ts, the button shows the office phone to book by instead.
 */
function EcwButton({ provider }: { provider: Provider }) {
  const [shown, setShown] = useState(false);
  if (provider.ecwUrl) {
    return (
      <ListingLink href={provider.ecwUrl} label={`${provider.name} on eClinicalWorks (healow)`}>
        eCW · healow
      </ListingLink>
    );
  }
  return (
    <div className="relative max-sm:flex-1">
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={`ecw-${provider.id}`}
        onClick={() => setShown((value) => !value)}
        className={`${LISTING} w-full`}
      >
        eCW · healow
        <Ico name="phone" className="h-3.5 w-3.5 text-plum-soft" />
      </button>
      {shown && (
        <p
          id={`ecw-${provider.id}`}
          role="status"
          className="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-xl border border-mist bg-white p-3 text-[0.85rem] leading-snug text-plum-soft shadow-lift max-sm:left-auto max-sm:right-0"
        >
          Online booking through eCW is coming soon. To book with{" "}
          {provider.name.split(",")[0]} there, call{" "}
          <a href={site.phoneHref} className="font-semibold text-wine link-underline">
            {site.phone}
          </a>
          .
        </p>
      )}
    </div>
  );
}

/** An outlined link to the provider's page on another booking site. */
function ListingLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} (opens in a new tab)`}
      className={LISTING}
    >
      {children}
      <Ico name="external" className="h-3.5 w-3.5 text-plum-soft" />
    </a>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: "star" | "shield" | "globe" | "pin" | "tag";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-wine-soft text-wine">
        <Ico name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <dt className={LABEL}>{label}</dt>
        <dd className="mt-1.5 text-[0.95rem] leading-relaxed text-plum">{children}</dd>
      </div>
    </div>
  );
}
