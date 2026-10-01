import Image from "next/image";
import Link from "next/link";
import BookLink from "@/components/analytics/BookLink";
import PhoneLink from "@/components/analytics/PhoneLink";
import { photos } from "@/lib/photos";
import { locations, navLinks, officeHours, site } from "@/lib/site";
import Ico from "./Ico";
import { CallAndBook, Container, Eyebrow } from "./ui";

const HEADING = "text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-plum";
const LINK = "focus-ring inline-flex py-1 text-[0.95rem] text-plum-soft transition hover:text-wine";

export default function SiteFooter() {
  return (
    <>
      {/* ----------------------------------------------------- closing CTA -- */}
      <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-night">
        <Image
          src={photos.saguaroSunset.src}
          alt=""
          fill
          sizes="100vw"
          placeholder="blur"
          className="-z-10 object-cover object-[50%_60%] opacity-85"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(29,22,25,.9)_0%,rgba(29,22,25,.62)_50%,rgba(29,22,25,.12)_100%)]"
        />
        <Container className="py-[clamp(4.5rem,10vw,8rem)]">
          <div className="reveal max-w-[620px]">
            <Eyebrow light>Phoenix &amp; Glendale</Eyebrow>
            <h2
              id="cta-title"
              className="mt-5 font-display text-[clamp(2.3rem,5vw,3.8rem)] font-normal leading-[1.04] tracking-[-0.02em] text-white"
            >
              Ready to be seen?
            </h2>
            <p className="mt-5 max-w-[44ch] text-[1.1rem] leading-relaxed text-white/75">
              Book your visit in under a minute — same-day appointments available.
            </p>
            <CallAndBook tone="dark" className="mt-9" />
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------- footer -- */}
      <footer className="bg-ivory text-plum-soft">
        <Container className="pb-10 pt-[clamp(3.5rem,7vw,5rem)]">
          <div className="grid gap-12 min-[700px]:grid-cols-2 min-[1060px]:grid-cols-[1.35fr_0.8fr_1.2fr_1fr] min-[1060px]:gap-10">
            <div>
              <Link href="/" aria-label={`${site.name} — home`} className="focus-ring inline-flex">
                <Image
                  src="/logo2-clear.png"
                  alt={`${site.name} — ${site.tagline}`}
                  width={454}
                  height={200}
                  className="h-[60px] w-auto"
                />
              </Link>
              <p className="mt-5 max-w-[32ch] text-[0.98rem] leading-relaxed">{site.footerBlurb}</p>
              <PhoneLink
                href={site.phoneHref}
                className="focus-ring mt-6 inline-flex items-center gap-2.5 font-display text-[1.5rem] text-plum transition hover:text-wine"
              >
                <Ico name="phone" className="h-5 w-5 text-wine" />
                {site.phone}
              </PhoneLink>
            </div>

            <nav aria-label="Footer">
              <h3 className={HEADING}>Explore</h3>
              <ul className="mt-5 space-y-1.5">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <BookLink
                    href={site.bookingUrl}
                    className="focus-ring inline-flex items-center gap-1.5 py-1 text-[0.95rem] font-medium text-wine"
                  >
                    Book online
                    <Ico name="arrow" className="h-4 w-4" />
                  </BookLink>
                </li>
              </ul>
            </nav>

            <div>
              <h3 className={HEADING}>Visit</h3>
              <ul className="mt-5 space-y-5">
                {locations.map((location) => (
                  <li key={location.name}>
                    <p className="font-medium text-plum">{location.name}</p>
                    <address className="mt-1 text-[0.95rem] not-italic leading-relaxed">
                      {location.address[0]}
                      <br />
                      {location.address[1]}
                    </address>
                    <a
                      href={location.maps}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring inline-flex min-h-11 items-center gap-1.5 text-[0.9rem] font-medium text-wine"
                    >
                      Directions
                      <Ico name="external" className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className={HEADING}>Hours</h3>
              <dl className="mt-5 space-y-3">
                {officeHours.map((row) => (
                  <div key={row.days}>
                    <dt className="font-medium text-plum">{row.days}</dt>
                    <dd className="text-[0.95rem]">{row.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-mist pt-6 text-[0.86rem]">
            <span>
              © {new Date().getFullYear()} {site.name}
            </span>
            <Link href="/privacy" className="focus-ring inline-flex min-h-11 items-center transition hover:text-wine">
              Privacy Policy
            </Link>
          </div>
        </Container>
      </footer>
    </>
  );
}
