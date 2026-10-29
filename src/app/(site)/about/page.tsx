import type { Metadata } from "next";
import Ico from "@/components/site/Ico";
import { BookingProvider } from "@/components/booking-context";
import { LangProvider } from "@/components/lang-context";
import ProviderDirectory from "@/components/site/ProviderDirectory";
import {
  BookButton,
  Eyebrow,
  Photo,
  PageHeader,
  Section,
} from "@/components/site/ui";
import { photos } from "@/lib/photos";
import { practice } from "@/lib/practice";
import { getProviderReasons } from "@/lib/repo";
import { arizonaTodayIso } from "@/lib/scheduling";
import { providerCreds, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Our Providers — ${site.name}`,
  description:
    "Meet the OB-GYN team at Arizona Women Specialists — doctors, nurse practitioners and physician assistants in Phoenix and Glendale. All accepting new patients.",
  alternates: { canonical: "/about" },
};

export default async function ProvidersPage() {
  // Each provider's visit reasons, for the booking form that opens here.
  const providerReasons = await getProviderReasons().catch(() => ({}));
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
        <div id="providers" className="scroll-mt-28">
          <LangProvider initial="en">
            <BookingProvider todayIso={arizonaTodayIso()} providerReasons={providerReasons}>
              <ProviderDirectory />
            </BookingProvider>
          </LangProvider>
        </div>

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
