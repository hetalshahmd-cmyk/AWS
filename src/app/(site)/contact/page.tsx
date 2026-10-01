import type { Metadata } from "next";
import BookLink from "@/components/analytics/BookLink";
import PhoneLink from "@/components/analytics/PhoneLink";
import Locations from "@/components/site/Locations";
import { CallAndBook, IconTile, PageHeader, Section } from "@/components/site/ui";
import { photos } from "@/lib/photos";
import { officeHours, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact & Locations — ${site.name}`,
  description:
    "Two Phoenix-area offices: 4700 N 51st Ave Ste 5, Phoenix and 6370 W Union Hills Dr, Glendale. Open Mon–Fri, 8:00 AM – 5:00 PM.",
  alternates: { canonical: "/contact" },
};

const TILE =
  "reveal focus-ring group flex items-center gap-4 rounded-[24px] border border-mist bg-white p-5 transition duration-300";
const LABEL = "block text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-stone";
const VALUE = "mt-1 block font-display text-[1.3rem] leading-tight text-plum";

export default function ContactPage() {
  const weekdays = officeHours[0];

  return (
    <>
      <PageHeader
        eyebrow="Visit us"
        title="Two Phoenix-area offices"
        body="Walk in or book ahead — we're easy to reach at either location."
        image={photos.phoenixAerial.src}
        imageAlt={photos.phoenixAerial.alt}
        imagePosition="50% 60%"
      >
        <CallAndBook />
      </PageHeader>

      <Section labelledBy="offices-title">
        <h2 id="offices-title" className="sr-only">
          Our offices
        </h2>

        <div className="mb-10 grid gap-4 min-[760px]:grid-cols-3">
          <PhoneLink
            href={site.phoneHref}
            className={`${TILE} hover:-translate-y-1 hover:border-wine/40 hover:shadow-soft`}
          >
            <IconTile name="phone" />
            <span>
              <span className={LABEL}>Call</span>
              <span className={`${VALUE} group-hover:text-wine`}>{site.phone}</span>
            </span>
          </PhoneLink>
          <div className={TILE}>
            <IconTile name="clock" />
            <span>
              <span className={LABEL}>Office Hours · {weekdays.days}</span>
              <span className={VALUE}>{weekdays.hours}</span>
            </span>
          </div>
          <BookLink
            href={site.bookingUrl}
            className={`${TILE} hover:-translate-y-1 hover:border-wine/40 hover:shadow-soft`}
          >
            <IconTile name="cal" />
            <span>
              <span className={LABEL}>Book online</span>
              <span className={`${VALUE} group-hover:text-wine`}>Book Now</span>
            </span>
          </BookLink>
        </div>

        <Locations />
      </Section>
    </>
  );
}
