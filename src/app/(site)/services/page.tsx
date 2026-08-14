import type { Metadata } from "next";
import Faq from "@/components/site/Faq";
import Ico from "@/components/site/Ico";
import { Band, SectionHead } from "@/components/site/ui";
import { services, site, steps } from "@/lib/site";

export const metadata: Metadata = {
  title: `Services — ${site.name}`,
  description:
    "Pregnancy testing, ultrasound, first-trimester and prenatal care, teen pregnancy support, and insurance help in Phoenix & Glendale.",
};

export default function ServicesPage() {
  return (
    <>
      <Band>
        <SectionHead
          eyebrow="What we offer"
          title="Complete care for you and your pregnancy"
          body="From your first pregnancy test to every prenatal visit — expert, judgment-free care under one roof."
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
          {services.map((service) => (
            <article
              key={service.title}
              className="rounded-2xl border border-mist bg-white p-6 shadow-[0_1px_2px_rgba(44,32,38,.05),0_14px_32px_-18px_rgba(92,30,45,.2)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_-22px_rgba(92,30,45,.32)]"
            >
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-sage-soft text-sage">
                <Ico name={service.icon} className="h-6 w-6" />
              </div>
              <h3 className="font-display text-[1.2rem] font-semibold">{service.title}</h3>
              <p className="mt-2 text-[0.97rem] text-plum-soft">{service.body}</p>
            </article>
          ))}
        </div>
      </Band>

      <Band tone="shell">
        <SectionHead eyebrow="How it works" title="Being seen is simple" center />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-mist bg-white p-6">
              <p className="font-display text-[1.5rem] text-wine">0{index + 1}</p>
              <div className="my-3 grid h-[42px] w-[42px] place-items-center rounded-xl bg-wine-soft text-wine">
                <Ico name={step.icon} className="h-[1.15em] w-[1.15em]" />
              </div>
              <h3 className="font-display text-[1.12rem] font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-[0.95rem] text-plum-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band>
        <SectionHead eyebrow="Good to know" title="Questions we hear a lot" />
        <Faq />
      </Band>
    </>
  );
}
