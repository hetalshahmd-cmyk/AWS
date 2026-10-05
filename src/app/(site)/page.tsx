import type { Metadata } from "next";
import Link from "next/link";
import HeroCarousel, { type HeroSlide } from "@/components/site/HeroCarousel";
import Ico from "@/components/site/Ico";
import InsuranceSection from "@/components/site/InsuranceSection";
import ServicesBento from "@/components/site/ServicesBento";
import StepsSection from "@/components/site/StepsSection";
import Locations from "@/components/site/Locations";
import Marquee from "@/components/site/Marquee";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import ZocdocReviews from "@/components/site/ZocdocReviews";
import {
  BookButton,
  Button,
  Eyebrow,
  IconTile,
  Photo,
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
      <Marquee items={heroChips} label="Why patients choose us" />

      {/* --------------------------------------------- free pregnancy test -- */}
      <Section tone="ivory" labelledBy="free-test-title">
        <div className="grid items-center gap-14 min-[960px]:grid-cols-[1.05fr_1fr] min-[960px]:gap-20">
          {/* Collage: a large photo, a smaller one overlapping it, and the offer as a badge. */}
          <div className="relative mx-auto aspect-[5/6] w-full max-w-[560px] min-[960px]:mx-0">
            <Photo
              src={photos.pregnancyHands.src}
              alt={photos.pregnancyHands.alt}
              sizes="(min-width: 960px) 40vw, 80vw"
              position="50% 40%"
              className="absolute left-0 top-0 h-[84%] w-[78%]"
            />
            <Photo
              src={photos.teenSupport.src}
              alt={photos.teenSupport.alt}
              sizes="(min-width: 960px) 22vw, 45vw"
              position="50% 30%"
              className="absolute bottom-0 right-0 h-[52%] w-[46%] border-[6px] border-ivory shadow-lift"
            />
            <div className="float-soft absolute right-[6%] top-[8%] grid h-[clamp(7rem,14vw,9rem)] w-[clamp(7rem,14vw,9rem)] place-items-center rounded-full bg-wine text-center text-white shadow-lift">
              <span>
                <span className="block font-display text-[clamp(1.8rem,3.4vw,2.4rem)] italic leading-none">
                  FREE
                </span>
                <span className="mt-1 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/80">
                  pregnancy test
                </span>
              </span>
            </div>
          </div>

          <div className="reveal">
            <Eyebrow>{site.announce.rest}</Eyebrow>
            <h2
              id="free-test-title"
              className="mt-5 font-display text-[clamp(2.3rem,4.8vw,3.7rem)] font-normal leading-[1.04] tracking-[-0.02em] text-plum"
            >
              Walk in for a <em className="italic text-wine">FREE</em> pregnancy test
            </h2>
            <p className="mt-5 max-w-[44ch] text-[1.15rem] leading-relaxed text-plum-soft">
              No appointment needed — get answers today.
            </p>

            <ul className="mt-10 border-t border-plum/10">
              {quickLinks.map((link) => (
                <li key={link.href} className="border-b border-plum/10">
                  <Link
                    href={link.href}
                    className="focus-ring group flex items-center gap-5 py-5 transition-colors"
                  >
                    <IconTile name={link.icon} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[1.4rem] leading-tight text-plum transition-colors group-hover:text-wine">
                        {link.title}
                      </span>
                      <span className="mt-0.5 block text-[0.93rem] text-plum-soft">
                        {link.body}
                      </span>
                    </span>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-plum/15 text-plum transition duration-300 group-hover:border-wine group-hover:bg-wine group-hover:text-white">
                      <Ico
                        name="arrow"
                        className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-45"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
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
          <Button
            href="/services"
            variant="line"
            arrow
            className="reveal mb-[clamp(2.25rem,5vw,3.5rem)]"
          >
            All services
          </Button>
        </div>
        <ServicesBento />
      </Section>

      {/* ------------------------------------------------------- providers -- */}
      <Section tone="sand" labelledBy="providers-title">
        <div className="grid items-center gap-16 min-[960px]:grid-cols-[1fr_1.05fr] min-[960px]:gap-20">
          <div className="relative mx-auto w-full max-w-[540px] pb-24 min-[960px]:mx-0 min-[960px]:pb-0">
            <Photo
              src={photos.ultrasoundCloseup.src}
              alt={photos.ultrasoundCloseup.alt}
              sizes="(min-width: 960px) 42vw, 90vw"
              position="62% 50%"
              className="aspect-[4/5] w-full"
            />
            {/* Floating roster: the providers' names sit on the photo as a card. */}
            <div className="reveal absolute -bottom-2 left-4 right-4 rounded-[24px] bg-white/95 p-5 shadow-lift backdrop-blur min-[560px]:left-auto min-[560px]:right-[-1.5rem] min-[560px]:w-[330px] min-[960px]:bottom-10">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1 text-[0.78rem] font-medium text-sage-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />
                Accepting new patients
              </p>
              <ul className="mt-4 space-y-3">
                {providers.map((provider) => (
                  <li key={provider.name} className="flex items-center gap-3">
                    <ProviderAvatar provider={provider} size="sm" />
                    <div className="min-w-0">
                      <p className="font-display text-[1.1rem] leading-tight text-plum">
                        {provider.name}
                      </p>
                      <p className="truncate text-[0.82rem] text-plum-soft">{provider.cred}</p>
                      <ZocdocReviews count={provider.zocdocReviews} className="mt-0.5" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="reveal">
            <Eyebrow>Meet our providers</Eyebrow>
            <h2
              id="providers-title"
              className="mt-5 font-display text-[clamp(2.2rem,4.6vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.02em] text-plum"
            >
              Care from a team that treats you with dignity
            </h2>
            <p className="mt-5 max-w-[52ch] text-[1.1rem] leading-relaxed text-plum-soft">
              Our OB-GYN providers have cared for women across the Phoenix area — built on fast
              access, honest pricing, and real respect, whatever your insurance, age, or situation.
            </p>

            <ul className="mt-9 grid gap-3 min-[520px]:grid-cols-2">
              {providerCreds.map((cred) => (
                <li
                  key={cred}
                  className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 text-[0.97rem] text-plum"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-wine-soft text-wine">
                    <Ico name="check" className="h-4 w-4" />
                  </span>
                  {cred}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-3 max-[480px]:flex-col">
              <Button href="/about" variant="line" arrow>
                Meet our providers
              </Button>
              <BookButton />
            </div>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------ how it works -- */}
      <StepsSection />

      {/* ------------------------------------------------------- insurance -- */}
      <Section>
        <InsuranceSection center photo="receptionTablet" />
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
