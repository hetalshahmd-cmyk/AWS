import type { Metadata } from "next";
import Link from "next/link";
import PhoneLink from "@/components/analytics/PhoneLink";
import Ico from "@/components/site/Ico";
import { CallAndBook, PageHeader, Section } from "@/components/site/ui";
import { photos } from "@/lib/photos";
import { insuranceLine, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Insurance — ${site.name}`,
  description:
    "We accept most major insurance plans and AHCCCS, and help you use your benefits. Call us to check your plan before your visit.",
  alternates: { canonical: "/insurance" },
};

/**
 * The Insurance tab. The list of accepted plans goes here once billing has
 * confirmed it (Nov 2026) — until then, no plan names are published.
 */
export default function InsurancePage() {
  return (
    <>
      <PageHeader
        eyebrow="Insurance"
        title="Insurance"
        body={insuranceLine}
        image={photos.receptionTablet.src}
        imageAlt={photos.receptionTablet.alt}
        imagePosition="65% 40%"
      >
        <CallAndBook />
      </PageHeader>

      <Section labelledBy="check-plan-title">
        <div className="grid gap-5 min-[860px]:grid-cols-2">
          <div className="reveal rounded-[28px] border border-mist bg-white p-[clamp(1.5rem,3vw,2rem)]">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-wine-soft text-wine">
              <Ico name="phone" className="h-5 w-5" />
            </span>
            <h2 id="check-plan-title" className="mt-4 font-display text-[1.6rem] leading-tight text-plum">
              Check your plan
            </h2>
            <p className="mt-3 leading-relaxed text-plum-soft">
              Not sure if we take your plan?{" "}
              <PhoneLink href={site.phoneHref} className="font-medium text-wine link-underline">
                Call {site.phone}
              </PhoneLink>{" "}
              and we&apos;ll check it for you.
            </p>
          </div>
          <div className="reveal rounded-[28px] border border-mist bg-white p-[clamp(1.5rem,3vw,2rem)]">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-wine-soft text-wine">
              <Ico name="cal" className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-display text-[1.6rem] leading-tight text-plum">Booking online</h2>
            <p className="mt-3 leading-relaxed text-plum-soft">
              Pick your insurance when you book. If your plan isn&apos;t in the list, type it in — our front desk
              checks your coverage before your visit.
            </p>
          </div>
        </div>

        <p className="reveal mt-10 text-plum-soft">
          No insurance?{" "}
          <Link href="/self-pay" className="font-medium text-wine link-underline">
            See our self-pay prices
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
