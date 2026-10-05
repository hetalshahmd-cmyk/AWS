import type { Metadata } from "next";
import Ico from "@/components/site/Ico";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import ZocdocReviews from "@/components/site/ZocdocReviews";
import {
  BookButton,
  Button,
  Eyebrow,
  Photo,
  PageHeader,
  Section,
} from "@/components/site/ui";
import { photos } from "@/lib/photos";
import { practice } from "@/lib/practice";
import { providerCreds, providers, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Our Providers — ${site.name}`,
  description:
    "Meet the OB-GYN team at Arizona Women Specialists — Dr. Hetalkumar Shah MD, Julie Denton NP, and Kylee Tate PA-C. All accepting new patients.",
  alternates: { canonical: "/about" },
};

export default function ProvidersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Meet our providers"
        title="Care from a team that treats you with dignity"
        body="Our OB-GYN providers have cared for women across the Phoenix area — built on fast access, honest pricing, and real respect, whatever your insurance, age, or situation."
        image={photos.clinicConsultWide.src}
        imageAlt={photos.clinicConsultWide.alt}
        imagePosition="50% 62%"
      >
        <BookButton size="lg" />
      </PageHeader>

      <Section labelledBy="team-title">
        <h2 id="team-title" className="sr-only">
          Our providers
        </h2>
        <ul className="grid gap-5 min-[760px]:grid-cols-2 min-[1060px]:grid-cols-3">
          {providers.map((provider) => (
            <li
              key={provider.name}
              className="reveal group flex flex-col overflow-hidden rounded-[28px] border border-mist bg-white transition duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              {/* Each card is banded in that provider's own colour. */}
              <div className={`relative h-36 bg-linear-to-br ${provider.avatar}`}>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,.28),transparent_55%)]"
                />
                <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[0.78rem] font-medium text-sage-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />
                  Accepting new patients
                </span>
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 transition-transform duration-500 group-hover:scale-105">
                  <ProviderAvatar provider={provider} size="lg" />
                </div>
              </div>

              <div className="flex flex-1 flex-col px-[clamp(1.5rem,3vw,2rem)] pb-[clamp(1.5rem,3vw,2rem)] pt-20 text-center">
                <h3 className="font-display text-[1.65rem] leading-tight text-plum">
                  {provider.name}
                </h3>
                <p className="mt-1.5 text-[0.95rem] font-medium text-sage-ink">{provider.cred}</p>
                <ZocdocReviews count={provider.zocdocReviews} className="mt-2 justify-center" />

                <div className="mt-6 border-t border-mist pt-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-stone">
                    Languages
                  </p>
                  <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {provider.languages.map((language) => (
                      <li
                        key={language}
                        className="rounded-full border border-mist bg-ivory px-3 py-1 text-[0.85rem] text-plum"
                      >
                        {language}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-8">
                  <Button href={site.bookingUrl} variant="line" icon="cal" className="w-full">
                    {provider.cta}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <ul className="reveal mt-12 flex flex-wrap justify-center gap-2.5">
          {providerCreds.map((cred) => (
            <li
              key={cred}
              className="inline-flex items-center gap-2 rounded-full border border-mist bg-white px-4 py-2 text-[0.92rem] text-plum"
            >
              <Ico name="check" className="h-4 w-4 text-sage" />
              {cred}
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="ivory" labelledBy="practice-title">
        <div className="grid items-center gap-14 min-[960px]:grid-cols-2 min-[960px]:gap-20">
          <div className="relative mx-auto aspect-square w-full max-w-[560px] min-[960px]:mx-0">
            <Photo
              src={photos.heroConsultation.src}
              alt={photos.heroConsultation.alt}
              sizes="(min-width: 960px) 36vw, 75vw"
              position="62% 50%"
              className="absolute right-0 top-0 h-[72%] w-[80%]"
            />
            <Photo
              src={photos.ultrasoundCloseup.src}
              alt={photos.ultrasoundCloseup.alt}
              sizes="(min-width: 960px) 22vw, 45vw"
              position="55% 50%"
              className="absolute bottom-0 left-0 h-[46%] w-[52%] border-[6px] border-ivory shadow-lift"
            />
          </div>
          <div className="reveal">
          <Eyebrow>About the practice</Eyebrow>
          <h2
            id="practice-title"
            className="mt-5 font-display text-[clamp(2.1rem,4.4vw,3.2rem)] font-normal leading-[1.06] tracking-[-0.02em] text-plum"
          >
            {practice.name}
          </h2>
          <div className="mt-6 space-y-4 text-[1.05rem] leading-relaxed text-plum-soft">
            {practice.bio.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-9">
            <BookButton />
          </div>
          </div>
        </div>
      </Section>
    </>
  );
}
