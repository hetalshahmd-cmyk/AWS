"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navLinks, site } from "@/lib/site";
import Ico from "./Ico";
import { BookButton } from "./ui";

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="border-b border-mist bg-shell px-4 py-2 text-center text-[0.84rem] text-plum-soft">
        <b className="text-wine">{site.announce.strong}</b> · {site.announce.rest}
      </div>

      <header className="sticky top-0 z-60 border-b border-mist bg-white/90 backdrop-blur-md">
        <div className="relative mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-[clamp(15px,4vw,40px)] py-2">
          <Link href="/" aria-label={`${site.name} — home`} className="focus-ring inline-flex">
            <Image
              src="/logo2.png"
              alt={`${site.name} — ${site.tagline}`}
              width={454}
              height={200}
              priority
              className="h-[46px] w-auto max-[560px]:h-[34px]"
            />
          </Link>

          <nav
            aria-label="Primary"
            className={`${
              open ? "flex" : "hidden"
            } absolute left-0 right-0 top-full flex-col border-b border-mist bg-white shadow-[0_1px_2px_rgba(44,32,38,.05),0_14px_32px_-18px_rgba(92,30,45,.2)] min-[880px]:static min-[880px]:flex min-[880px]:flex-row min-[880px]:gap-6 min-[880px]:border-0 min-[880px]:shadow-none`}
          >
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`focus-ring border-b border-mist px-[clamp(18px,6vw,40px)] py-3.5 text-[0.96rem] font-medium transition min-[880px]:border-b-2 min-[880px]:px-0 min-[880px]:py-1 ${
                    active
                      ? "bg-shell text-wine min-[880px]:border-b-wine min-[880px]:bg-transparent"
                      : "text-plum-soft hover:text-wine min-[880px]:border-b-transparent"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href={site.phoneHref}
              className="focus-ring hidden items-center gap-1.5 whitespace-nowrap font-semibold text-sage min-[880px]:inline-flex"
            >
              <Ico name="phone" className="h-[1.15em] w-[1.15em]" />
              {site.phone}
            </a>
            <BookButton size="sm" />
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              aria-label="Menu"
              aria-expanded={open}
              className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-mist text-plum min-[880px]:hidden"
            >
              <Ico name="menu" className="h-[22px] w-[22px]" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
