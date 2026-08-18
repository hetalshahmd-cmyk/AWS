import { insurancePills, insurancePlans, site } from "@/lib/site";
import Ico from "./Ico";
import { SectionHead } from "./ui";
import PhoneLink from "@/components/analytics/PhoneLink";

export default function InsuranceSection({ center = false }: { center?: boolean }) {
  return (
    <>
      <SectionHead
        eyebrow="Insurance"
        title="Most major insurance plans accepted"
        body={
          center
            ? "Including AHCCCS & Medicare. Don't see yours? Call us — chances are we take it."
            : "We work with a wide range of insurers — including AHCCCS & Medicare plans. Don't see yours? Call us — chances are we take it."
        }
        center={center}
      />

      <div
        className={`mb-6 flex max-w-[820px] flex-wrap gap-2 ${center ? "mx-auto justify-center" : ""}`}
      >
        {insurancePills.map((pill) => (
          <span
            key={pill}
            className="inline-flex items-center rounded-full bg-sage-soft px-3 py-1.5 text-[0.9rem] font-semibold text-sage-ink"
          >
            {pill}
          </span>
        ))}
      </div>

      <details
        className={`max-w-[820px] rounded-2xl border border-mist bg-white shadow-[0_1px_2px_rgba(44,32,38,.05),0_14px_32px_-18px_rgba(92,30,45,.2)] ${
          center ? "mx-auto" : ""
        } [&[open]_.chev]:rotate-180`}
      >
        <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-semibold [&::-webkit-details-marker]:hidden">
          See all accepted plans (60+)
          <Ico name="chev" className="chev h-[1.15em] w-[1.15em] text-wine transition" />
        </summary>
        <ul className="grid max-h-[360px] grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 overflow-y-auto px-6 pb-5 pt-1">
          {insurancePlans.map((plan) => (
            <li
              key={plan}
              className="flex items-start gap-2 border-b border-mist py-1.5 text-[0.88rem] text-plum-soft"
            >
              <Ico name="check" className="mt-1 h-[1em] w-[1em] shrink-0 text-sage" />
              {plan}
            </li>
          ))}
        </ul>
      </details>

      <p className="mt-5 text-plum-soft">
        Have a plan not listed?{" "}
        <PhoneLink href={site.phoneHref} className="font-semibold text-wine link-underline">
          Call {site.phone}
        </PhoneLink>{" "}
        — we&apos;ll check it for you.
      </p>
    </>
  );
}
