"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navLinks, site } from "@/lib/site";
import PhoneLink from "@/components/analytics/PhoneLink";
import Ico from "./Ico";
import UserMenu from "./UserMenu";
import { BookButton, Button } from "./ui";

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // The header lifts off the page once you scroll — a hairline and a shadow.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mobile menu: lock the page behind it, close on Escape, and hand focus in
  // and back out so keyboard and screen-reader users never get lost.
  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[80] rounded-full bg-plum px-4 py-2 font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <div className="bg-night px-4 py-2 text-center text-[0.82rem] tracking-[0.02em] text-white/80">
        <b className="font-semibold text-white">{site.announce.strong}</b>
        <span aria-hidden="true" className="mx-2 text-white/40">
          ·
        </span>
        {site.announce.rest}
      </div>

      <header
        className={`sticky top-0 z-60 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
          scrolled || open
            ? "border-mist bg-white/92 shadow-[0_10px_30px_-24px_rgba(36,28,32,.45)] backdrop-blur-xl"
            : "border-transparent bg-ivory"
        }`}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between gap-6 px-[clamp(20px,5vw,48px)]">
          <Link
            href="/"
            aria-label={`${site.name} — home`}
            className="focus-ring inline-flex shrink-0"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/logo2-clear.png"
              alt={`${site.name} — ${site.tagline}`}
              width={454}
              height={200}
              preload
              className="h-[46px] w-auto max-[560px]:h-[38px]"
            />
          </Link>

          <nav aria-label="Primary" className="hidden min-[1060px]:block">
            <ul className="flex items-center gap-8">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`focus-ring group relative py-2 text-[0.95rem] font-medium transition-colors ${
                        active ? "text-plum" : "text-plum-soft hover:text-plum"
                      }`}
                    >
                      {link.label}
                      <span
                        aria-hidden="true"
                        className={`absolute -bottom-0.5 left-0 h-px bg-wine transition-all duration-300 ${
                          active ? "w-full" : "w-0 group-hover:w-full"
                        }`}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <PhoneLink
              href={site.phoneHref}
              className="focus-ring hidden items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-[0.95rem] font-medium text-plum transition hover:text-wine min-[1200px]:inline-flex"
            >
              <Ico name="phone" className="h-4 w-4 text-wine" />
              {site.phone}
            </PhoneLink>
            <span className="hidden min-[640px]:inline-flex">
              <UserMenu />
            </span>
            <BookButton
              size="sm"
              label="Book Appointment"
              className="whitespace-nowrap max-[639px]:hidden"
            />
            {/* Phones: the short label keeps booking one tap away without crowding the bar. */}
            <BookButton size="sm" label="Book Now" className="whitespace-nowrap min-[640px]:hidden" />
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-mist bg-white text-plum transition hover:border-plum min-[1060px]:hidden"
            >
              <Ico name={open ? "close" : "menu"} className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------- mobile menu -- */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
        className="fixed inset-0 z-50 overflow-y-auto bg-ivory min-[1060px]:hidden"
      >
        {/* Starts below the header, which stays on top and holds the close button. */}
        <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col px-[clamp(20px,5vw,48px)] pb-10 pt-[156px]">
          <nav aria-label="Mobile">
            <ul className="divide-y divide-mist border-y border-mist">
              {navLinks.map((link, index) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      ref={index === 0 ? firstLinkRef : undefined}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`focus-ring flex items-center justify-between py-4 font-display text-[1.75rem] leading-tight transition ${
                        active ? "text-wine" : "text-plum hover:text-wine"
                      }`}
                    >
                      {link.label}
                      <Ico name="arrow" className="h-5 w-5 text-plum/40" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-8 grid gap-3">
            <BookButton size="lg" label="Book Appointment" />
            <Button href={site.phoneHref} variant="line" size="lg" icon="phone">
              Call {site.phone}
            </Button>
          </div>

          <div className="mt-6 flex justify-center min-[640px]:hidden" onClick={() => setOpen(false)}>
            <UserMenu />
          </div>

          <p className="mt-auto pt-10 text-center text-[0.88rem] text-plum-soft">
            {site.announce.strong} · {site.announce.rest}
          </p>
        </div>
      </div>
    </>
  );
}
