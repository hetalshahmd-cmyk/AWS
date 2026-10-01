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
            // it gets the quiet emphasis whatever an admin calls it.
            const featured = index === 0;
            return (
              <li
                key={price.title}
                className={`reveal group relative flex flex-col rounded-[28px] border p-[clamp(1.75rem,3vw,2.25rem)] transition duration-300 hover:-translate-y-1 ${
                  featured
                    ? "border-wine/30 bg-wine-soft/60 hover:shadow-lift"
                    : "border-mist bg-white hover:shadow-soft"
                }`}
              >
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-sage-ink">
                  <Ico name={price.tagIcon} className="h-3.5 w-3.5" />
                  {price.tag}
                </span>
                <h3 className="mt-6 font-display text-[1.45rem] leading-tight text-plum">
                  {price.title}
                </h3>
                <p className="mt-2 flex-1 text-[0.98rem] leading-relaxed text-plum-soft">
                  {price.body}
                </p>
                <p className="mt-8 border-t border-plum/10 pt-6 font-display text-[3.4rem] leading-none tabular-nums tracking-[-0.02em] text-wine">
                  {price.amount}
                </p>
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
