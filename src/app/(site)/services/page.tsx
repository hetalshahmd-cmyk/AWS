import type { Metadata } from "next";
import Image from "next/image";
import Faq from "@/components/site/Faq";
import Ico from "@/components/site/Ico";
import StepsSection from "@/components/site/StepsSection";
import {
  BookButton,
  Button,
  CallAndBook,
  Container,
  Eyebrow,
  PageHeader,
  Photo,
  Section,
  SectionHead,
} from "@/components/site/ui";
import { photos, type PhotoKey } from "@/lib/photos";
import { services, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Services — ${site.name}`,
  description:
    "Pregnancy testing, ultrasound, first-trimester and prenatal care, teen pregnancy support, and insurance help in Phoenix & Glendale.",
  alternates: { canonical: "/services" },
};

/**
 * How each service is presented: its photograph and a soft accent colour.
 * Keyed by the service's title; the wording always comes from lib/site.
 */
const SERVICE_LOOK: Record<string, { photo: PhotoKey; position: string; accent: string }> = {
  "Pregnancy Testing": { photo: "pregnancyTest", position: "40% 50%", accent: "bg-wine-soft" },
  Ultrasound: { photo: "ultrasoundScan", position: "50% 50%", accent: "bg-sage-soft" },
  "First-Trimester Care": { photo: "firstTrimester", position: "60% 40%", accent: "bg-sand" },
  "Prenatal Care": { photo: "prenatalUltrasound", position: "60% 40%", accent: "bg-wine-soft" },
  "Teen Pregnancy Support": { photo: "teenSupport", position: "50% 30%", accent: "bg-sage-soft" },
  "Insurance & AHCCCS": { photo: "receptionDesk", position: "55% 45%", accent: "bg-sand" },
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="What we offer"
        title="Complete care for you and your pregnancy"
        body="From your first pregnancy test to every prenatal visit — expert, judgment-free care under one roof."
        image={photos.ultrasoundScreen.src}
        imageAlt={photos.ultrasoundScreen.alt}
        imagePosition="55% 50%"
      >
        <CallAndBook />
      </PageHeader>

      {/* Index of the six services — jumps to each row below. */}
      <nav aria-label="Services on this page" className="border-y border-mist bg-white">
        <Container>
          <ul className="no-scrollbar flex gap-2 overflow-x-auto py-4">
            {services.map((service, index) => (
              <li key={service.title} className="shrink-0">
                <a
                  href={`#service-${index + 1}`}
                  className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-mist px-4 text-[0.92rem] text-plum-soft transition hover:border-wine hover:text-wine"
                >
                  <span className="font-display text-stone">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {service.title}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <section aria-labelledby="services-list" className="bg-white">
        <h2 id="services-list" className="sr-only">
          Our services
        </h2>
        <Container className="space-y-[clamp(4rem,9vw,7rem)] py-[clamp(4rem,9vw,7.5rem)]">
          {services.map((service, index) => {
            const look = SERVICE_LOOK[service.title];
            const flip = index % 2 === 1;
            const number = String(index + 1).padStart(2, "0");
            return (
              <article
                key={service.title}
                id={`service-${index + 1}`}
                className="grid items-center gap-10 min-[900px]:grid-cols-2 min-[900px]:gap-[clamp(3rem,7vw,6rem)]"
              >
                <div className={`relative ${flip ? "min-[900px]:order-2" : ""}`}>
                  {/* A tinted block offset behind the photo gives each row its own colour. */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-0 translate-x-4 translate-y-4 rounded-[28px] ${look?.accent ?? "bg-sand"} ${
                      flip ? "min-[900px]:-translate-x-5" : "min-[900px]:translate-x-5"
                    } min-[900px]:translate-y-5`}
                  />
                  {look && (
                    <Photo
                      src={photos[look.photo].src}
                      alt={photos[look.photo].alt}
                      sizes="(min-width: 900px) 50vw, 100vw"
                      position={look.position}
                      className="aspect-[4/3] w-full"
                    />
                  )}
                </div>

                <div className="reveal relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-10 right-0 font-display text-[clamp(6rem,12vw,9rem)] leading-none text-plum/[0.06] min-[900px]:-top-16"
                  >
                    {number}
                  </span>
                  <Eyebrow>Service {number}</Eyebrow>
                  <div className="mt-5 flex items-center gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-wine text-white">
                      <Ico name={service.icon} className="h-6 w-6" />
                    </span>
                    <h3 className="font-display text-[clamp(2rem,4vw,2.9rem)] font-normal leading-[1.05] tracking-[-0.015em] text-plum">
                      {service.title}
                    </h3>
                  </div>
                  <p className="mt-6 max-w-[46ch] text-[1.15rem] leading-relaxed text-plum-soft">
                    {service.body}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <BookButton />
                    <Button href={site.phoneHref} variant="line" icon="phone">
                      Call
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </Container>
      </section>

      <StepsSection />

      <Section tone="ivory" labelledBy="faq-title">
        <div className="grid gap-12 min-[960px]:grid-cols-[0.85fr_1.15fr] min-[960px]:gap-16">
          <div className="min-[960px]:sticky min-[960px]:top-28 min-[960px]:self-start">
            <SectionHead id="faq-title" eyebrow="Good to know" title="Questions we hear a lot" />
            <div className="reveal relative hidden aspect-[4/3] overflow-hidden rounded-[28px] bg-sand min-[960px]:block">
              <Image
                src={photos.receptionTablet.src}
                alt={photos.receptionTablet.alt}
                fill
                sizes="35vw"
                placeholder="blur"
                className="object-cover object-[70%_40%]"
              />
            </div>
            <Button href={site.phoneHref} variant="line" icon="phone" className="reveal mt-8">
              Call {site.phone}
            </Button>
          </div>
          <Faq />
        </div>
      </Section>
    </>
  );
}
