import { insurancePills, insurancePlans, site } from "@/lib/site";
import Ico from "./Ico";
import { SectionHead } from "./ui";
import PhoneLink from "@/components/analytics/PhoneLink";

export default function InsuranceSection({ center = false }: { center?: boolean }) {
  return (
    <div className="grid gap-10 min-[1000px]:grid-cols-[0.85fr_1.15fr] min-[1000px]:gap-16">
      <div>
        <SectionHead
          eyebrow="Insurance"
          title="Most major insurance plans accepted"
          body={
            center
              ? "Including AHCCCS & Medicare. Don't see yours? Call us — chances are we take it."
              : "We work with a wide range of insurers — including AHCCCS & Medicare plans. Don't see yours? Call us — chances are we take it."
          }
          className="mb-6!"
        />
        <p className="reveal text-plum-soft">
          Have a plan not listed?{" "}
          <PhoneLink href={site.phoneHref} className="font-medium text-wine link-underline">
            Call {site.phone}
          </PhoneLink>{" "}
          — we&apos;ll check it for you.
        </p>
      </div>

      <div className="reveal">
        <ul className="flex flex-wrap gap-2.5">
          {insurancePills.map((pill) => (
            <li
              key={pill}
              className="inline-flex min-h-12 items-center gap-2.5 rounded-full border border-mist bg-white px-4.5 py-2.5 text-[0.95rem] font-medium leading-snug text-plum"
            >
              <Ico name="check" className="h-4 w-4 shrink-0 text-sage" />
              {pill}
            </li>
          ))}
        </ul>

        <details className="group mt-4 rounded-2xl border border-mist bg-white">
          <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 font-medium text-plum [&::-webkit-details-marker]:hidden">
            See all accepted plans (60+)
            <Ico
              name="chev"
              className="h-5 w-5 shrink-0 text-wine transition-transform duration-300 group-open:rotate-180"
            />
          </summary>
          <ul className="grid max-h-[360px] grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 overflow-y-auto border-t border-mist px-5 pb-5 pt-2">
            {insurancePlans.map((plan) => (
              <li
                key={plan}
                className="flex items-start gap-2 border-b border-mist/70 py-2 text-[0.9rem] text-plum-soft"
              >
                <Ico name="check" className="mt-1 h-[1em] w-[1em] shrink-0 text-sage" />
                {plan}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
