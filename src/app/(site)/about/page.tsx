import type { Metadata } from "next";
import Ico from "@/components/site/Ico";
import { Band, BookButton, Button, SectionHead } from "@/components/site/ui";
import { providerCreds, providers, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Our Providers — ${site.name}`,
  description:
    "Meet the OB-GYN team at Arizona Women Specialists — Dr. Hetal Shah MD, Julie Denton NP, and Kylee Tate PA. All accepting new patients.",
};

export default function ProvidersPage() {
  return (
    <Band>
      <SectionHead
        eyebrow="Meet our providers"
        title="Care from a team that treats you with dignity"
        body="Our OB-GYN providers have cared for women across the Phoenix area — built on fast access, honest pricing, and real respect, whatever your insurance, age, or situation."
        center
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {providers.map((provider) => (
          <article
            key={provider.name}
            className="flex flex-col items-center rounded-2xl border border-mist bg-white px-6 py-7 text-center shadow-[0_1px_2px_rgba(44,32,38,.05),0_14px_32px_-18px_rgba(92,30,45,.2)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_-22px_rgba(92,30,45,.32)]"
          >
            <div
              aria-hidden="true"
              className={`mb-4 grid h-[86px] w-[86px] place-items-center rounded-full bg-gradient-to-br ${provider.avatar} font-display text-[1.9rem] text-white shadow-[0_1px_2px_rgba(44,32,38,.05),0_14px_32px_-18px_rgba(92,30,45,.2)]`}
            >
              {provider.initials}
            </div>
            <h3 className="font-display text-[1.18rem] font-semibold">{provider.name}</h3>
            <p className="mt-1 text-[0.9rem] font-semibold text-sage">{provider.cred}</p>

            <div className="my-4 flex flex-wrap justify-center gap-1.5">
              <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[0.76rem] font-semibold text-sage-ink">
                Accepting new patients
              </span>
              {provider.languages.map((language) => (
                <span
                  key={language}
                  className="rounded-full border border-mist bg-shell px-2.5 py-1 text-[0.76rem] text-plum-soft"
                >
                  {language}
                </span>
              ))}
            </div>

            <Button href="/book" variant="line" size="sm" className="mt-auto">
              {provider.cta}
            </Button>
          </article>
        ))}
      </div>

      <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
        {providerCreds.map((cred) => (
          <li
            key={cred}
            className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-white px-3.5 py-1.5 text-[0.9rem] font-medium"
          >
            <Ico name="check" className="h-[1.15em] w-[1.15em] text-sage" />
            {cred}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex justify-center">
        <BookButton />
      </div>
    </Band>
  );
}
