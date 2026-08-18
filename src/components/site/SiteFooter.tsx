import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";
import PhoneLink from "@/components/analytics/PhoneLink";
import { BookButton, Button } from "./ui";

export default function SiteFooter() {
  return (
    <>
      <section className="border-t border-mist bg-shell text-center">
        <div className="mx-auto max-w-[1120px] px-[clamp(15px,4vw,40px)] py-[clamp(2.6rem,6vw,4.2rem)]">
          <h2 className="font-display text-[clamp(1.7rem,3.6vw,2.6rem)] font-semibold leading-[1.12]">
            Ready to be seen?
          </h2>
          <p className="mx-auto mt-3.5 max-w-[44ch] text-plum-soft">
            Book your visit in under a minute — same-day appointments available.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 max-[480px]:flex-col">
            <BookButton />
            <Button href={site.phoneHref} variant="line" icon="phone">
              Call {site.phone}
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-mist bg-white text-plum-soft">
        <div className="mx-auto max-w-[1120px] px-[clamp(15px,4vw,40px)] pb-6 pt-[clamp(2.4rem,5vw,3.4rem)]">
          <div className="mb-8 grid gap-7 min-[760px]:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Link href="/" aria-label={`${site.name} — home`} className="focus-ring inline-flex">
                <Image
                  src="/logo2.png"
                  alt={`${site.name} — ${site.tagline}`}
                  width={454}
                  height={200}
                  className="mb-3.5 h-[54px] w-auto"
                />
              </Link>
              <p className="max-w-[32ch] text-[0.94rem]">{site.footerBlurb}</p>
            </div>

            <div>
              <h3 className="mb-2.5 font-display text-[1.05rem] font-semibold text-plum">Explore</h3>
              {[
                { href: "/services", label: "Services" },
                { href: "/pricing", label: "Pricing" },
                { href: "/about", label: "Our Providers" },
                { href: "/contact", label: "Contact & Hours" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="focus-ring block py-1 text-[0.94rem] transition hover:text-wine"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div>
              <h3 className="mb-2.5 font-display text-[1.05rem] font-semibold text-plum">
                Get in touch
              </h3>
              <PhoneLink
                href={site.phoneHref}
                className="focus-ring block py-1 text-[0.94rem] transition hover:text-wine"
              >
                {site.phone}
              </PhoneLink>
              <Link
                href="/contact"
                className="focus-ring block py-1 text-[0.94rem] transition hover:text-wine"
              >
                Phoenix · 4700 N 51st Ave, Ste 5
              </Link>
              <Link
                href="/contact"
                className="focus-ring block py-1 text-[0.94rem] transition hover:text-wine"
              >
                Glendale · 6370 W Union Hills Dr
              </Link>
              <Link
                href="/book"
                className="focus-ring block py-1 text-[0.94rem] font-semibold text-wine"
              >
                Book online →
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-mist pt-5 text-[0.85rem]">
            <span>© {new Date().getFullYear()} {site.name}</span>
            <Link href="/privacy" className="focus-ring transition hover:text-wine">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
