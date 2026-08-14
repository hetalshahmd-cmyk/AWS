import type { Metadata } from "next";
import Ico from "@/components/site/Ico";
import InsuranceSection from "@/components/site/InsuranceSection";
import { Band, BookButton, SectionHead } from "@/components/site/ui";
import { site } from "@/lib/site";
import { getPlans } from "@/lib/repo";
import type { Plan } from "@/lib/models";

export const metadata: Metadata = {
  title: `Pricing — ${site.name}`,
  description:
    "Transparent self-pay pricing: $100 new patient visit, $75 follow-up, $75 ultrasound, plus birth control services. AHCCCS & WIC accepted.",
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
      <Band>
        <SectionHead
          eyebrow="Honest, upfront pricing"
          title="Simple visit pricing — no surprises"
          body="Transparent self-pay rates. On AHCCCS or WIC? We'll help you use your coverage."
        />

        <div className="mb-7 flex max-w-[820px] flex-wrap items-center gap-4 rounded-2xl border border-wine/20 bg-wine-soft px-5 py-4">
          <span className="rounded-[10px] bg-wine px-3 py-2 text-[0.82rem] font-extrabold tracking-[0.08em] text-white">
            FREE
          </span>
          <div className="min-w-[200px] flex-1">
            <b className="block font-display text-[1.08rem] font-semibold text-plum">
              Walk in for a FREE pregnancy test
            </b>
            <span className="text-[0.92rem] text-plum-soft">
              No appointment needed — get answers today.
            </span>
          </div>
          <BookButton size="sm" />
        </div>

        {prices.length === 0 && (
          <p className="rounded-2xl border border-mist bg-shell p-6 text-plum-soft">
            Our current rates aren&apos;t showing right now — please call {site.phone} and we&apos;ll
            quote your visit.
          </p>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {prices.map((price) => (
            <div
              key={price.title}
              className="rounded-2xl border border-mist bg-white p-7"
            >
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-[0.08em] text-sage">
                <Ico name={price.tagIcon} className="h-[1.15em] w-[1.15em]" />
                {price.tag}
              </span>
              <div className="mt-2 font-display text-[3rem] leading-none tabular-nums text-wine">
                {price.amount}
              </div>
              <h3 className="mt-1 font-display text-[1.16rem] font-semibold">{price.title}</h3>
              <p className="mt-1.5 text-[0.95rem] text-plum-soft">{price.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3 text-plum-soft">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1.5 text-[0.9rem] font-semibold text-sage-ink">
            <Ico name="tag" className="h-[1.15em] w-[1.15em]" />
            AHCCCS &amp; WIC accepted
          </span>
          <span>
            Not sure what applies to you?{" "}
            <a href={site.phoneHref} className="font-semibold text-wine link-underline">
              Call us
            </a>{" "}
            and we&apos;ll walk you through it.
          </span>
        </div>

        <div className="mt-8">
          <BookButton />
        </div>
      </Band>

      <Band tone="shell">
        <InsuranceSection />
      </Band>
    </>
  );
}
