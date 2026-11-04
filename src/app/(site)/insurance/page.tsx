import type { Metadata } from "next";
import Link from "next/link";
import PhoneLink from "@/components/analytics/PhoneLink";
import Ico from "@/components/site/Ico";
import NetworksExplorer from "@/components/site/NetworksExplorer";
import { BookButton, Button, CallAndBook, Eyebrow, PageHeader, Section } from "@/components/site/ui";
import { photos } from "@/lib/photos";
import { acceptedNetworks } from "@/lib/practice";
import { insuranceLine, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Insurance — ${site.name}`,
  description:
    "We accept most major insurance plans and AHCCCS, plus networks like Velocity, CorVel, MultiPlan Claritev, Prime Health and Galaxy Health. Call us to check your plan before your visit.",
  alternates: { canonical: "/insurance" },
};

/**
 * The Insurance tab. It lists the networks the practice confirmed (Nov 2026);
 * the same list feeds the insurance picker on the booking form.
 */
export default function InsurancePage() {
  const planCount = acceptedNetworks.reduce((sum, network) => sum + network.plans.length, 0);
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

      <Section labelledBy="networks-title" tone="ivory">
        <div className="relative">
          {/* Soft wine glow behind the heading */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 -top-48 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(124,44,62,0.09),transparent_65%)]"
          />

          <div className="relative mb-[clamp(2rem,4vw,3rem)] grid items-end gap-8 min-[980px]:grid-cols-[1.35fr_1fr]">
            <div className="reveal max-w-[640px]">
              <Eyebrow>Accepted networks</Eyebrow>
              <h2
                id="networks-title"
                className="mt-4 font-display text-[clamp(2.2rem,4.6vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.02em] text-plum"
              >
                Insurance networks <em className="italic text-wine">we accept</em>
              </h2>
              <p className="mt-5 max-w-[54ch] text-[clamp(1.02rem,1.4vw,1.12rem)] leading-relaxed text-plum-soft">
                Along with most major insurance plans and AHCCCS, we accept these networks. Search for yours, or
                filter by the kind of coverage you have.
              </p>
            </div>

            <div className="reveal relative overflow-hidden rounded-[28px] bg-night p-[clamp(1.5rem,3vw,2rem)] text-white shadow-[0_30px_70px_-40px_rgba(29,22,25,0.9)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(182,90,109,0.45),transparent_70%)]"
              />
              <dl className="relative grid grid-cols-2 gap-6">
                <div>
                  <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/55">Networks</dt>
                  <dd className="mt-2 font-display text-[clamp(2.6rem,5vw,3.4rem)] leading-none">{acceptedNetworks.length}</dd>
                </div>
                <div>
                  <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/55">Plans</dt>
                  <dd className="mt-2 font-display text-[clamp(2.6rem,5vw,3.4rem)] leading-none">{planCount}</dd>
                </div>
              </dl>
              <p className="relative mt-6 flex items-center gap-2.5 border-t border-white/10 pt-5 text-[0.95rem] text-white/75">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-white">
                  <Ico name="check" className="h-3.5 w-3.5" />
                </span>
                Plus most major insurance plans and AHCCCS
              </p>
            </div>
          </div>

          <div className="relative">
            <NetworksExplorer networks={acceptedNetworks}>
              <div className="relative flex w-full flex-col overflow-hidden rounded-[26px] bg-plum p-[clamp(1.35rem,2.4vw,1.75rem)] text-white">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-20 -right-16 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(78,123,115,0.5),transparent_70%)]"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(182,90,109,0.35),transparent_70%)]"
                />
                <span className="relative grid h-[3.4rem] w-[3.4rem] place-items-center rounded-full bg-white/10 text-white ring-[5px] ring-white/5">
                  <Ico name="phone" className="h-5 w-5" />
                </span>
                <h3 className="relative mt-5 font-display text-[1.6rem] leading-tight">Don&apos;t see your insurance?</h3>
                <p className="relative mt-2 text-[0.97rem] leading-relaxed text-white/70">
                  Chances are we accept it. Call us, or pick &ldquo;My insurance isn&apos;t listed&rdquo; when you book —
                  our front desk checks your coverage before your visit.
                </p>
                <div className="relative mt-auto flex flex-col gap-2.5 pt-6">
                  <Button href={site.phoneHref} variant="light" icon="phone">
                    Call {site.phone}
                  </Button>
                  <BookButton variant="ghost" />
                </div>
              </div>
            </NetworksExplorer>
          </div>
        </div>
      </Section>

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
