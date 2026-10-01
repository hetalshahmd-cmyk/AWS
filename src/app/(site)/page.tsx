import type { Metadata } from "next";
import Link from "next/link";
import HeroCarousel, { type HeroSlide } from "@/components/site/HeroCarousel";
import Ico from "@/components/site/Ico";
import InsuranceSection from "@/components/site/InsuranceSection";
import StepsSection from "@/components/site/StepsSection";
import Locations from "@/components/site/Locations";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import {
  BookButton,
  Button,
  Container,
  Eyebrow,
  IconTile,
  MediaSplit,
  Section,
  SectionHead,
} from "@/components/site/ui";
import { photos } from "@/lib/photos";
import { heroChips, providerCreds, providers, quickLinks, services, site } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Captions reuse the service names and descriptions already on the site. */
const serviceByTitle = (title: string) => {
  const service = services.find((item) => item.title === title);
  if (!service) throw new Error(`Unknown service: ${title}`);
  return { title: service.title, body: service.body };
};

const SLIDES: HeroSlide[] = [
  {
    image: photos.heroConsultation.src,
    alt: photos.heroConsultation.alt,
    focus: { desktop: "50% 40%", mobile: "62% 50%" },
    caption: serviceByTitle("Prenatal Care"),
  },
  {
    image: photos.heroUltrasound.src,
    alt: photos.heroUltrasound.alt,
    focus: { desktop: "50% 35%", mobile: "66% 40%" },
    caption: serviceByTitle("Ultrasound"),
  },
  {
    image: photos.heroPregnancy.src,
    alt: photos.heroPregnancy.alt,
    focus: { desktop: "50% 50%", mobile: "64% 50%" },
    caption: serviceByTitle("First-Trimester Care"),
  },
];

export default function HomePage() {
  return (
    <>
      {/* ------------------------------------------------------------ hero -- */}
      <HeroCarousel slides={SLIDES}>
        <Eyebrow className="text-wine min-[900px]:text-white/85 [&>span]:bg-wine/60 min-[900px]:[&>span]:bg-white/60">
          Board-Certified OB-GYN · Phoenix &amp; Glendale, AZ
        </Eyebrow>
        <h1 className="mt-5 font-display text-[clamp(2.5rem,6vw,4.75rem)] font-normal leading-[1.02] tracking-[-0.025em]">
          Women&apos;s health &amp; pregnancy care,{" "}
          <em className="font-normal italic text-wine min-[900px]:text-[#f3d7dd]">
            the same day you call.
          </em>
        </h1>
        <p className="mt-6 max-w-[46ch] text-[clamp(1.05rem,1.5vw,1.2rem)] leading-relaxed text-plum-soft min-[900px]:text-white/85">
          {site.description}
        </p>
        <div className="mt-9 flex flex-wrap gap-3 max-[480px]:flex-col">
          <BookButton size="lg" />
          <Button href={site.phoneHref} variant="hero" size="lg" icon="phone">
            Call {site.phone}
          </Button>
        </div>
      </HeroCarousel>

      {/* ------------------------------------------------------ trust row -- */}
      <section aria-label="Why patients choose us" className="border-b border-mist bg-white">
        <Container>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-4 py-8 min-[700px]:grid-cols-3 min-[1100px]:grid-cols-6">
            {heroChips.map((chip) => (
              <li key={chip} className="flex items-center gap-2.5 text-[0.95rem] text-plum">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sage-soft text-sage-ink">
                  <Ico name="check" className="h-3.5 w-3.5" />
                </span>
                {chip}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* --------------------------------------------- free pregnancy test -- */}
      <Section tone="ivory">
        <MediaSplit
          image={photos.pregnancyHands.src}
          imageAlt={photos.pregnancyHands.alt}
          imagePosition="50% 40%"
        >
          <Eyebrow>{site.announce.rest}</Eyebrow>
          <h2 className="mt-5 font-display text-[clamp(2.2rem,4.6vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.02em] text-plum">
            Walk in for a <em className="italic text-wine">FREE</em> pregnancy test
          </h2>
          <p className="mt-5 max-w-[44ch] text-[1.12rem] leading-relaxed text-plum-soft">
            No appointment needed — get answers today.
          </p>

          <ul className="mt-9 grid gap-4 min-[520px]:grid-cols-3">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="focus-ring group flex h-full items-center gap-4 rounded-2xl border border-mist bg-white p-4 transition duration-300 hover:-translate-y-1 hover:border-wine/40 hover:shadow-soft min-[520px]:flex-col min-[520px]:items-start min-[520px]:gap-0 min-[520px]:p-5"
                >
                  <IconTile name={link.icon} size="sm" />
                  <span className="min-w-0 flex-1 min-[520px]:mt-4">
                    <span className="block font-display text-[1.15rem] leading-tight text-plum">
                      {link.title}
                    </span>
                    <span className="mt-1 block text-[0.86rem] leading-snug text-plum-soft">
                      {link.body}
                    </span>
                  </span>
                  <Ico
                    name="arrow"
                    className="h-4 w-4 shrink-0 text-wine transition-transform duration-300 group-hover:translate-x-1 min-[520px]:mt-4"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </MediaSplit>
      </Section>

      {/* -------------------------------------------------------- services -- */}
      <Section labelledBy="services-title">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            id="services-title"
            eyebrow="What we offer"
            title="Complete care for you and your pregnancy"
            body="From your first pregnancy test to every prenatal visit — expert, judgment-free care under one roof."
          />
          <Button href="/services" variant="line" arrow className="reveal mb-[clamp(2.25rem,5vw,3.5rem)]">
            All services
          </Button>
        </div>

        <ul className="grid gap-px overflow-hidden rounded-[28px] border border-mist bg-mist min-[640px]:grid-cols-2 min-[1000px]:grid-cols-3">
          {services.map((service, index) => (
            <li key={service.title} className="reveal group bg-white">
              <Link
                href="/services"
                className="focus-ring flex h-full flex-col p-[clamp(1.75rem,3vw,2.5rem)] transition-colors duration-300 hover:bg-ivory"
              >
                <div className="flex items-center justify-between">
                  <IconTile name={service.icon} tone="sage" />
                  <span className="font-display text-[1rem] text-stone">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-8 font-display text-[1.55rem] leading-tight text-plum">
                  {service.title}
                </h3>
                <p className="mt-3 flex-1 text-[0.98rem] leading-relaxed text-plum-soft">
                  {service.body}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-[0.92rem] font-medium text-wine">
                  Learn more
                  <Ico
                    name="arrow"
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------- providers -- */}
      <Section tone="sand" labelledBy="providers-title">
        <MediaSplit
          image={photos.consultTablet.src}
          imageAlt={photos.consultTablet.alt}
          imagePosition="40% 30%"
          reverse
        >
          <Eyebrow>Meet our providers</Eyebrow>
          <h2
            id="providers-title"
            className="mt-5 font-display text-[clamp(2.1rem,4.4vw,3.3rem)] font-normal leading-[1.06] tracking-[-0.02em] text-plum"
          >
            Care from a team that treats you with dignity
          </h2>
          <p className="mt-5 max-w-[52ch] text-[1.08rem] leading-relaxed text-plum-soft">
            Our OB-GYN providers have cared for women across the Phoenix area — built on fast
            access, honest pricing, and real respect, whatever your insurance, age, or situation.
          </p>

          <ul className="mt-8 divide-y divide-mist border-y border-mist">
            {providers.map((provider) => (
              <li key={provider.name} className="flex items-center gap-4 py-4">
                <ProviderAvatar provider={provider} size="sm" />
                <div className="min-w-0">
                  <p className="font-display text-[1.2rem] leading-tight text-plum">
                    {provider.name}
                  </p>
                  <p className="text-[0.9rem] text-plum-soft">{provider.cred}</p>
                </div>
              </li>
            ))}
          </ul>

          <ul className="mt-6 flex flex-wrap gap-2">
            {providerCreds.map((cred) => (
              <li
                key={cred}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[0.86rem] text-plum"
              >
                <Ico name="check" className="h-3.5 w-3.5 text-sage" />
                {cred}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap gap-3 max-[480px]:flex-col">
            <Button href="/about" variant="line" arrow>
              Meet our providers
            </Button>
            <BookButton />
          </div>
        </MediaSplit>
      </Section>

      {/* ------------------------------------------------------ how it works -- */}
      <StepsSection />

      {/* ------------------------------------------------------- insurance -- */}
      <Section>
        <InsuranceSection center />
      </Section>

      {/* ------------------------------------------------------- locations -- */}
      <Section tone="ivory" labelledBy="visit-title">
        <SectionHead
          id="visit-title"
          eyebrow="Visit us"
          title="Two Phoenix-area offices"
          body="Walk in or book ahead — we're easy to reach at either location."
        />
        <Locations />
      </Section>
    </>
  );
}
