import { steps } from "@/lib/site";
import { IconTile, Section, SectionHead } from "./ui";

/** "Being seen is simple" — the three steps, on the dark band. */
export default function StepsSection() {
  return (
    <Section tone="night" labelledBy="steps-title">
      <SectionHead id="steps-title" eyebrow="How it works" title="Being seen is simple" light />
      <ol className="grid gap-px overflow-hidden rounded-[28px] bg-white/10 min-[860px]:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="reveal bg-night p-[clamp(1.75rem,3vw,2.75rem)]">
            <div className="flex items-center justify-between">
              <span className="font-display text-[3.5rem] leading-none text-white/25">
                {String(index + 1).padStart(2, "0")}
              </span>
              <IconTile name={step.icon} tone="light" />
            </div>
            <h3 className="mt-8 font-display text-[1.6rem] text-white">{step.title}</h3>
            <p className="mt-3 max-w-[34ch] leading-relaxed text-white/70">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
