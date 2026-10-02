import Image from "next/image";
import { photos, type PhotoKey } from "@/lib/photos";
import { steps } from "@/lib/site";
import Ico from "./Ico";
import { BookButton, Section, SectionHead } from "./ui";

/** One photograph per step, in the order the steps are listed in lib/site. */
const STEP_PHOTOS: { key: PhotoKey; position: string }[] = [
  { key: "bookingPhone", position: "40% 35%" },
  { key: "receptionDesk", position: "55% 45%" },
  { key: "heroConsultation", position: "62% 40%" },
];

/** "Being seen is simple" — a photographic timeline on the dark band. */
export default function StepsSection() {
  return (
    <Section tone="night" labelledBy="steps-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-wine/25 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <SectionHead id="steps-title" eyebrow="How it works" title="Being seen is simple" light />
        <BookButton variant="light" className="reveal mb-[clamp(2.25rem,5vw,3.5rem)]" />
      </div>

      <ol className="relative grid gap-6 min-[900px]:grid-cols-3 min-[900px]:gap-8">
        {/* The thread that ties the three steps together on wide screens. */}
        <span
          aria-hidden="true"
          className="absolute left-[8%] right-[8%] top-[118px] hidden border-t border-dashed border-white/25 min-[900px]:block"
        />
        {steps.map((step, index) => {
          const photo = STEP_PHOTOS[index];
          return (
            <li
              key={step.title}
              className={`reveal relative ${index === 1 ? "min-[900px]:mt-16" : ""}`}
            >
              <div className="group relative aspect-[4/3] overflow-hidden rounded-[24px] bg-white/5">
                {photo && (
                  <Image
                    src={photos[photo.key].src}
                    alt={photos[photo.key].alt}
                    fill
                    sizes="(min-width: 900px) 33vw, 100vw"
                    placeholder="blur"
                    className="object-cover opacity-90 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-100"
                    style={{ objectPosition: photo.position }}
                  />
                )}
                <span className="absolute left-5 top-5 grid h-14 w-14 place-items-center rounded-full bg-white font-display text-[1.5rem] text-plum shadow-lift">
                  {index + 1}
                </span>
              </div>
              <div className="mt-6 flex items-start gap-4">
                <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 text-white">
                  <Ico name={step.icon} className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <h3 className="font-display text-[1.65rem] leading-tight text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[34ch] leading-relaxed text-white/70">{step.body}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
