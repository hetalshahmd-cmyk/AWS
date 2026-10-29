import type { Metadata } from "next";
import Ico from "@/components/site/Ico";
import InsuranceSection from "@/components/site/InsuranceSection";
import PriceCard from "@/components/site/PriceCard";
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
          {prices.map((price, index) => (
            <PriceCard
              key={price.title}
              price={price}
              index={index}
              reveal
              footer={(featured) => (
                <BookButton size="sm" variant={featured ? "light" : "line"} label="Book" />
              )}
            />
          ))}
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
