import Link from "next/link";
import HeroIllustration from "@/components/site/HeroIllustration";
import Ico from "@/components/site/Ico";
import InsuranceSection from "@/components/site/InsuranceSection";
import { Band, BookButton, Button } from "@/components/site/ui";
import { heroChips, quickLinks, site } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      <div className="bg-[linear-gradient(158deg,#FAF3F5_0%,#FFFFFF_60%)]">
        <div className="mx-auto max-w-[1120px] px-[clamp(15px,4vw,40px)] pb-[clamp(2.4rem,5vw,3.6rem)] pt-[clamp(2.4rem,5.5vw,4rem)]">
          <div className="grid items-center gap-8 min-[900px]:grid-cols-[1.12fr_0.82fr] min-[900px]:gap-12">
            <div>
              <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-wine">
                Board-Certified OB-GYN · Phoenix &amp; Glendale, AZ
              </p>
              <h1 className="mt-3 font-display text-[clamp(2.1rem,5.2vw,3.5rem)] font-semibold leading-[1.12]">
                Women&apos;s health &amp; pregnancy care, the same day you call.
              </h1>
              <p className="mt-4 max-w-[40ch] text-[clamp(1.05rem,1.6vw,1.2rem)] text-plum-soft">
                {site.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-3 max-[480px]:flex-col">
                <BookButton />
                <Button href={site.phoneHref} variant="line" icon="phone">
                  Call {site.phone}
                </Button>
              </div>
              <ul className="mt-7 flex flex-wrap gap-2.5">
                {heroChips.map((chip) => (
                  <li
                    key={chip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-sage-soft px-3.5 py-1.5 text-[0.9rem] text-sage-ink"
                  >
                    <Ico name="check" className="h-[1.15em] w-[1.15em] text-sage" />
                    {chip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-center">
              <HeroIllustration />
            </div>
          </div>

          <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring flex items-center gap-3 rounded-2xl border border-mist bg-white px-5 py-4 shadow-[0_1px_2px_rgba(44,32,38,.05),0_14px_32px_-18px_rgba(92,30,45,.2)] transition hover:-translate-y-1 hover:border-wine"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-wine-soft text-wine">
                  <Ico name={link.icon} className="h-[1.15em] w-[1.15em]" />
                </span>
                <span>
                  <b className="block font-display text-[1.05rem] font-semibold">{link.title}</b>
                  <span className="text-[0.86rem] text-plum-soft">{link.body}</span>
                </span>
                <Ico name="arrow" className="ml-auto h-[1.15em] w-[1.15em] text-wine" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Band>
        <InsuranceSection center />
      </Band>
    </>
  );
}
