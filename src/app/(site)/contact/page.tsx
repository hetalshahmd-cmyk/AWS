import type { Metadata } from "next";
import Ico from "@/components/site/Ico";
import { Band, BookButton, Button, SectionHead } from "@/components/site/ui";
import { locations, officeHours, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact & Locations — ${site.name}`,
  description:
    "Two Phoenix-area offices: 4700 N 51st Ave Ste 5, Phoenix and 6370 W Union Hills Dr, Glendale. Open Mon–Fri, 8:00 AM – 5:00 PM.",
};

const CARD =
  "rounded-2xl border border-mist bg-white p-7 shadow-[0_1px_2px_rgba(44,32,38,.05),0_14px_32px_-18px_rgba(92,30,45,.2)]";

export default function ContactPage() {
  return (
    <Band>
      <SectionHead
        eyebrow="Visit us"
        title="Two Phoenix-area offices"
        body="Walk in or book ahead — we're easy to reach at either location."
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
        {locations.map((location) => (
          <div key={location.name} className={CARD}>
            <h3 className="flex items-center gap-2 font-display text-[1.2rem] font-semibold">
              <Ico name="pin" className="h-[1.15em] w-[1.15em] text-wine" />
              {location.name}
            </h3>
            <address className="mt-3 not-italic leading-relaxed text-plum-soft">
              {location.address[0]}
              <br />
              {location.address[1]}
            </address>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button href={site.phoneHref} variant="line" size="sm" icon="phone">
                Call
              </Button>
              <Button href={location.maps} variant="line" size="sm" icon="pin">
                Directions
              </Button>
            </div>
          </div>
        ))}

        <div className={CARD}>
          <h3 className="flex items-center gap-2 font-display text-[1.2rem] font-semibold">
            <Ico name="clock" className="h-[1.15em] w-[1.15em] text-wine" />
            Office Hours
          </h3>
          <ul aria-label="Office hours" className="mt-4 text-[0.95rem] text-plum-soft">
            {officeHours.map((row) => (
              <li
                key={row.days}
                className="flex justify-between gap-4 border-b border-dashed border-mist py-1.5"
              >
                <span>{row.days}</span>
                <span>{row.hours}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <BookButton size="sm" />
          </div>
        </div>
      </div>
    </Band>
  );
}
