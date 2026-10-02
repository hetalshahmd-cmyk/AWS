import type { Metadata } from "next";
import Ico from "@/components/site/Ico";
import InsuranceSection from "@/components/site/InsuranceSection";
import { BookButton, CallAndBook, PageHeader, Section } from "@/components/site/ui";
import { photos } from "@/lib/photos";
import { site } from "@/lib/site";
import { getPlans } from "@/lib/repo";
import type { Plan } from "@/lib/models";
import PhoneLink from "@/components/analytics/PhoneLink";

export const metadata: Metadata = {
  title: `Pricing — ${site.name}`,
  description:
    "Transparent self-pay pricing: $100 new patient visit, $75 follow-up, $75 ultrasound, plus birth control services. AHCCCS & WIC accepted.",
  alternates: { canonical: "/pricing" },
};

// Prices are managed from /admin/pricing, so read them on every request.
export const dynamic = "force-dynamic";

/** One accent per price category, matched on the tag an admin sets. */
const TAG_ACCENT: Record<string, { chip: string; glow: string }> = {
  "New Patient": { chip: "bg-wine-soft text-wine", glow: "bg-wine-soft" },
  Returning: { chip: "bg-sand text-plum", glow: "bg-sand" },
  Imaging: { chip: "bg-sage-soft text-sage-ink", glow: "bg-sage-soft" },
  "Birth Control": { chip: "bg-wine-soft text-wine-deep", glow: "bg-wine-soft" },
  default: { chip: "bg-ivory text-plum", glow: "bg-sand" },
};

export default async function PricingPage() {
  let prices: Pick<Plan, "tag" | "tagIcon" | "amount" | "title" | "body">[] = [];
  try {
    prices = await getPlans();
  } catch (error) {
    console.error("Could not load plans from MongoDB", error);
  }

  return (
    <>
      <PageHeader
        eyebrow="Honest, upfront pricing"
        title="Simple visit pricing — no surprises"
        body="Transparent self-pay rates. On AHCCCS or WIC? We'll help you use your coverage."
        image={photos.stethoscope.src}
        imageAlt={photos.stethoscope.alt}
        imagePosition="50% 50%"
      >
        <CallAndBook />
      </PageHeader>

      <Section labelledBy="prices-title">
        <h2 id="prices-title" className="sr-only">
          Visit prices
        </h2>

        {/* The free test leads — it is the one price that is always zero. */}
        <div className="reveal relative mb-12 overflow-hidden rounded-[28px] bg-night px-[clamp(1.5rem,4vw,3rem)] py-[clamp(1.75rem,4vw,2.5rem)] text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-wine/40 blur-3xl"
          />
          <div className="relative flex flex-wrap items-center gap-x-8 gap-y-5">
            <span className="font-display text-[clamp(2.6rem,5vw,3.5rem)] italic leading-none text-[#f3d7dd]">
              FREE
            </span>
            <div className="min-w-[220px] flex-1">
              <p className="font-display text-[clamp(1.35rem,2.4vw,1.75rem)] leading-tight">
                Walk in for a FREE pregnancy test
              </p>
              <p className="mt-1.5 text-white/70">No appointment needed — get answers today.</p>
            </div>
            <BookButton variant="light" />
          </div>
        </div>

        {prices.length === 0 && (
          <p className="rounded-[24px] border border-mist bg-ivory p-7 text-plum-soft">
            Our current rates aren&apos;t showing right now — please call {site.phone} and we&apos;ll
            quote your visit.
          </p>
        )}

        <ul className="grid gap-5 min-[640px]:grid-cols-2 min-[1060px]:grid-cols-3">
          {prices.map((price, index) => {
            // The first card is the new-patient visit in the default ordering;
            // it gets the dark feature treatment whatever an admin calls it.
            const featured = index === 0;
            const accent = TAG_ACCENT[price.tag] ?? TAG_ACCENT.default;
            return (
              <li
                key={price.title}
                className={`reveal group relative flex flex-col overflow-hidden rounded-[28px] p-[clamp(1.75rem,3vw,2.25rem)] transition duration-500 hover:-translate-y-1.5 ${
                  featured
                    ? "bg-night text-white shadow-lift min-[1060px]:row-span-1"
                    : "border border-mist bg-white hover:shadow-lift"
                }`}
              >
                {/* Coloured corner glow — one hue per category. */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-2xl transition-opacity duration-500 ${
                    featured ? "bg-wine/60 opacity-100" : `${accent.glow} opacity-70 group-hover:opacity-100`
                  }`}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.14em] ${
                      featured ? "bg-white/10 text-white" : accent.chip
                    }`}
                  >
                    <Ico name={price.tagIcon} className="h-3.5 w-3.5" />
                    {price.tag}
                  </span>
                  <span className={`font-display text-[0.95rem] ${featured ? "text-white/50" : "text-stone"}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className={`relative mt-8 font-display text-[1.55rem] leading-tight ${featured ? "text-white" : "text-plum"}`}>
                  {price.title}
                </h3>
                <p className={`relative mt-2 flex-1 text-[0.98rem] leading-relaxed ${featured ? "text-white/70" : "text-plum-soft"}`}>
                  {price.body}
                </p>
                <div className={`relative mt-8 flex items-end justify-between gap-4 border-t pt-6 ${featured ? "border-white/15" : "border-plum/10"}`}>
                  <p
                    className={`font-display text-[3.6rem] leading-none tabular-nums tracking-[-0.02em] ${
                      featured ? "text-[#f3d7dd]" : "text-wine"
                    }`}
                  >
                    {price.amount}
                  </p>
                  <BookButton size="sm" variant={featured ? "light" : "line"} label="Book" />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="reveal mt-12 flex flex-wrap items-center justify-between gap-6 rounded-[28px] border border-mist bg-ivory p-[clamp(1.5rem,3vw,2rem)]">
          <div className="flex flex-wrap items-center gap-4 text-plum-soft">
            <span className="inline-flex items-center gap-2 rounded-full bg-sage-soft px-3.5 py-1.5 text-[0.9rem] font-medium text-sage-ink">
              <Ico name="tag" className="h-4 w-4" />
              AHCCCS &amp; WIC accepted
            </span>
            <span>
              Not sure what applies to you?{" "}
              <PhoneLink href={site.phoneHref} className="font-medium text-wine link-underline">
                Call us
              </PhoneLink>{" "}
              and we&apos;ll walk you through it.
            </span>
          </div>
          <BookButton />
        </div>
      </Section>

      <Section tone="sand">
        <InsuranceSection />
      </Section>
    </>
  );
}
