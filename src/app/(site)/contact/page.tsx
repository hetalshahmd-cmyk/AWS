import type { Metadata } from "next";
import BookLink from "@/components/analytics/BookLink";
import PhoneLink from "@/components/analytics/PhoneLink";
import Locations from "@/components/site/Locations";
import { CallAndBook, IconTile, PageHeader, Section } from "@/components/site/ui";
import { photos } from "@/lib/photos";
import { getOfficeHours } from "@/lib/repo";
import { hoursEmpty, OFFICE_IDS, WEEKDAY_NAMES } from "@/lib/scheduling";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact & Locations — ${site.name}`,
  description:
    "Two Phoenix-area offices: 4700 N 51st Ave Ste 5, Phoenix and 6370 W Union Hills Dr, Glendale. See this week's hours for each office.",
  alternates: { canonical: "/contact" },
};

const TILE =
  "reveal focus-ring group flex items-center gap-4 rounded-[24px] border border-mist bg-white p-5 transition duration-300";
const LABEL = "block text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-stone";
const VALUE = "mt-1 block font-display text-[1.3rem] leading-tight text-plum";

/** "Mon – Fri" and earliest – latest appointment across both offices this week. */
function overallHours(hours: Awaited<ReturnType<typeof getOfficeHours>>) {
  if (!hours || hoursEmpty(hours)) return null;
  const open = [1, 2, 3, 4, 5, 6, 0].filter((weekday) =>
    OFFICE_IDS.some((id) => hours[id].find((day) => day.weekday === weekday)?.first),
  );
  const toMin = (time: string) => {
    const [, h, m, s] = /^(\d{1,2}):(\d{2}) (am|pm)$/.exec(time) ?? [];
    return ((Number(h) % 12) + (s === "pm" ? 12 : 0)) * 60 + Number(m);
  };
  const all = OFFICE_IDS.flatMap((id) => hours[id]).filter((day) => day.first);
  const first = all.map((day) => day.first!).sort((a, b) => toMin(a) - toMin(b))[0];
  const last = all.map((day) => day.last!).sort((a, b) => toMin(b) - toMin(a))[0];
  const name = (weekday: number) => WEEKDAY_NAMES[weekday].slice(0, 3);
  const days = open.length > 1 ? `${name(open[0])} – ${name(open.at(-1)!)}` : name(open[0]);
  return { days, hours: `${first} – ${last}` };
}

export default async function ContactPage() {
  const weekdays = overallHours(await getOfficeHours());

  return (
    <>
      <PageHeader
        eyebrow="Visit us"
        title="Two Phoenix-area offices"
        body="Walk in or book ahead — we're easy to reach at either location."
        image={photos.superstition.src}
        imageAlt={photos.superstition.alt}
        imagePosition="40% 60%"
      >
        <CallAndBook />
      </PageHeader>

      <Section labelledBy="offices-title">
        <h2 id="offices-title" className="sr-only">
          Our offices
        </h2>

        {/* Call, fax and email on top; hours and booking below — the email is too long for a fifth of the row. */}
        <div className="mb-10 grid gap-4 min-[640px]:grid-cols-2 min-[1060px]:grid-cols-6">
          <PhoneLink
            href={site.phoneHref}
            className={`${TILE} hover:-translate-y-1 hover:border-wine/40 hover:shadow-soft min-[1060px]:col-span-2`}
          >
            <IconTile name="phone" />
            <span>
              <span className={LABEL}>Call</span>
              <span className={`${VALUE} group-hover:text-wine`}>{site.phone}</span>
            </span>
          </PhoneLink>
          <div className={`${TILE} min-[1060px]:col-span-2`}>
            <IconTile name="fax" />
            <span>
              <span className={LABEL}>Fax</span>
              <span className={VALUE}>{site.fax}</span>
            </span>
          </div>
          <a
            href={site.emailHref}
            className={`${TILE} hover:-translate-y-1 hover:border-wine/40 hover:shadow-soft min-[640px]:col-span-2 min-[1060px]:col-span-2`}
          >
            <IconTile name="mail" />
            <span className="min-w-0">
              <span className={LABEL}>Email</span>
              <span className={`${VALUE} break-words text-[1.05rem] group-hover:text-wine`}>{site.email}</span>
            </span>
          </a>
          <div className={`${TILE} min-[1060px]:col-span-3`}>
            <IconTile name="clock" />
            <span>
              <span className={LABEL}>
                {weekdays ? `This week · ${weekdays.days}` : "Office hours"}
              </span>
              <span className={VALUE}>{weekdays ? weekdays.hours : "Call for times"}</span>
            </span>
          </div>
          <BookLink
            href={site.bookCta}
            className={`${TILE} hover:-translate-y-1 hover:border-wine/40 hover:shadow-soft min-[1060px]:col-span-3`}
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
