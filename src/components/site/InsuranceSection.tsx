import Image from "next/image";
import { photos, type PhotoKey } from "@/lib/photos";
import { insurancePills, insurancePlans, site } from "@/lib/site";
import Ico from "./Ico";
import { SectionHead } from "./ui";
import PhoneLink from "@/components/analytics/PhoneLink";

export default function InsuranceSection({
  center = false,
  photo,
}: {
  center?: boolean;
  /** Adds a photograph under the heading, with the plan count floating on it. */
  photo?: PhotoKey;
}) {
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

        {photo && (
          <div className="reveal relative mt-10 hidden aspect-[4/3] min-[1000px]:block">
            <div className="relative h-full overflow-hidden rounded-[28px] bg-sand">
              <Image
                src={photos[photo].src}
                alt={photos[photo].alt}
                fill
                sizes="(min-width: 1000px) 40vw, 100vw"
                placeholder="blur"
                className="object-cover object-[65%_40%]"
              />
            </div>
            <div className="float-soft absolute -bottom-6 -right-6 rounded-[22px] bg-white px-6 py-5 shadow-lift">
              <p className="font-display text-[2.4rem] leading-none text-wine">60+</p>
              <p className="mt-1 text-[0.85rem] font-medium text-plum-soft">accepted plans</p>
            </div>
          </div>
        )}
      </div>

      <div className="reveal self-start rounded-[28px] bg-ivory p-[clamp(1.25rem,3vw,2rem)]">
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

        <details className="group mt-5 rounded-2xl border border-mist bg-white">
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
