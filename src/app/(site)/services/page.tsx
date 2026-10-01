import type { Metadata } from "next";
import Image from "next/image";
import Faq from "@/components/site/Faq";
import StepsSection from "@/components/site/StepsSection";
import {
  Button,
  CallAndBook,
  IconTile,
  PageHeader,
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

/** Which photograph illustrates which service. Keyed by the service's title. */
const SERVICE_PHOTO: Record<string, { key: PhotoKey; position: string }> = {
  "Pregnancy Testing": { key: "pregnancyHands", position: "50% 45%" },
  Ultrasound: { key: "ultrasoundScan", position: "50% 50%" },
  "First-Trimester Care": { key: "heroConsultation", position: "60% 50%" },
  "Prenatal Care": { key: "prenatalUltrasound", position: "60% 40%" },
  "Teen Pregnancy Support": { key: "consultTablet", position: "45% 30%" },
  "Insurance & AHCCCS": { key: "stethoscope", position: "50% 55%" },
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

      <Section labelledBy="services-list">
        <h2 id="services-list" className="sr-only">
          Our services
        </h2>
        <ul className="grid gap-x-6 gap-y-12 min-[700px]:grid-cols-2 min-[1060px]:grid-cols-3">
          {services.map((service, index) => {
            const photo = SERVICE_PHOTO[service.title];
            return (
              <li key={service.title} className="reveal group flex flex-col">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-sand">
                  {photo && (
                    <Image
                      src={photos[photo.key].src}
                      alt={photos[photo.key].alt}
                      fill
                      sizes="(min-width: 1060px) 33vw, (min-width: 700px) 50vw, 100vw"
                      placeholder="blur"
                      className="object-cover transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.04]"
                      style={{ objectPosition: photo.position }}
                    />
                  )}
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 font-display text-[0.95rem] text-plum backdrop-blur">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex flex-1 flex-col pt-6">
                  <div className="flex items-center gap-3">
                    <IconTile name={service.icon} tone="sage" size="sm" />
                    <h3 className="font-display text-[1.6rem] leading-tight text-plum">
                      {service.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-[1.02rem] leading-relaxed text-plum-soft">
                    {service.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <StepsSection />

      <Section tone="ivory" labelledBy="faq-title">
        <div className="grid gap-10 min-[960px]:grid-cols-[0.8fr_1.2fr] min-[960px]:gap-16">
          <div>
            <SectionHead id="faq-title" eyebrow="Good to know" title="Questions we hear a lot" />
            <Button href={site.phoneHref} variant="line" icon="phone" className="reveal">
              Call {site.phone}
            </Button>
          </div>
          <Faq />
        </div>
      </Section>
    </>
  );
}

