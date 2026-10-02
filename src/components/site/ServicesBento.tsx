import Image from "next/image";
import Link from "next/link";
import { photos, type PhotoKey } from "@/lib/photos";
import { services } from "@/lib/site";
import Ico from "./Ico";

/**
 * The six services as a bento grid — each tile has its own treatment so the
 * section reads as a composition rather than a row of identical cards.
 * Keyed by service title; the copy itself always comes from lib/site.
 */
type Look =
  | { kind: "photo"; photo: PhotoKey; position: string; span: string }
  | { kind: "tone"; tone: "ivory" | "sage" | "wine"; span: string };

const LOOKS: Record<string, Look> = {
  "Pregnancy Testing": {
    kind: "photo",
    photo: "pregnancyTest",
    position: "40% 50%",
    span: "min-[1000px]:col-span-2 min-[1000px]:row-span-2",
  },
  Ultrasound: {
    kind: "photo",
    photo: "ultrasoundCloseup",
    position: "55% 50%",
    span: "min-[1000px]:col-span-2",
  },
  "First-Trimester Care": { kind: "tone", tone: "ivory", span: "" },
  "Prenatal Care": {
    kind: "photo",
    photo: "prenatalUltrasound",
    position: "60% 35%",
    span: "",
  },
  "Teen Pregnancy Support": { kind: "tone", tone: "sage", span: "min-[1000px]:col-span-2" },
  "Insurance & AHCCCS": { kind: "tone", tone: "wine", span: "min-[1000px]:col-span-2" },
};

const TONE = {
  ivory: { card: "bg-ivory border border-mist", title: "text-plum", body: "text-plum-soft", icon: "bg-white text-wine", link: "text-wine" },
  sage: { card: "bg-sage-soft", title: "text-sage-ink", body: "text-sage-ink/80", icon: "bg-white text-sage-ink", link: "text-sage-ink" },
  wine: { card: "bg-wine", title: "text-white", body: "text-white/80", icon: "bg-white/15 text-white", link: "text-white" },
};

export default function ServicesBento() {
  return (
    <ul className="grid auto-rows-[minmax(260px,auto)] gap-4 min-[640px]:grid-cols-2 min-[1000px]:grid-cols-4">
      {services.map((service, index) => {
        const look = LOOKS[service.title] ?? { kind: "tone", tone: "ivory", span: "" };
        const number = String(index + 1).padStart(2, "0");

        if (look.kind === "photo") {
          const photo = photos[look.photo];
          const big = look.span.includes("row-span-2");
          return (
            <li key={service.title} className={`reveal ${look.span}`}>
              <Link
                href="/services"
                className="focus-ring group relative flex h-full min-h-[300px] flex-col justify-end overflow-hidden rounded-[28px] bg-night p-7 text-white"
              >
                <Image
                  src={photo.src}
                  alt=""
                  fill
                  sizes={big ? "(min-width: 1000px) 50vw, 100vw" : "(min-width: 1000px) 50vw, (min-width: 640px) 50vw, 100vw"}
                  placeholder="blur"
                  className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.06]"
                  style={{ objectPosition: look.position }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[linear-gradient(180deg,rgba(29,22,25,0)_30%,rgba(29,22,25,.82)_100%)]"
                />
                <span className="absolute right-6 top-6 rounded-full bg-white/85 px-3 py-1 font-display text-[0.95rem] text-plum backdrop-blur">
                  {number}
                </span>
                <span className="relative">
                  <span
                    className={`block font-display leading-tight ${big ? "text-[clamp(2rem,3.4vw,2.7rem)]" : "text-[1.7rem]"}`}
                  >
                    {service.title}
                  </span>
                  <span className="mt-2 block max-w-[40ch] text-[0.98rem] leading-relaxed text-white/80">
                    {service.body}
                  </span>
                  <span className="mt-5 inline-flex items-center gap-2 text-[0.92rem] font-medium">
                    Learn more
                    <Ico
                      name="arrow"
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </span>
                </span>
              </Link>
            </li>
          );
        }

        const t = TONE[look.tone];
        return (
          <li key={service.title} className={`reveal ${look.span}`}>
            <Link
              href="/services"
              className={`focus-ring group relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-[28px] p-7 transition duration-500 hover:-translate-y-1 ${t.card}`}
            >
              {/* Oversized icon as a quiet watermark. */}
              <Ico
                name={service.icon}
                className={`pointer-events-none absolute -bottom-8 -right-8 h-44 w-44 opacity-[0.08] transition-transform duration-700 group-hover:rotate-6 ${t.title}`}
              />
              <div className="flex items-center justify-between">
                <span className={`grid h-12 w-12 place-items-center rounded-full ${t.icon}`}>
                  <Ico name={service.icon} className="h-[22px] w-[22px]" />
                </span>
                <span className={`font-display text-[1rem] opacity-60 ${t.title}`}>{number}</span>
              </div>
              <span className={`mt-auto block pt-10 font-display text-[1.7rem] leading-tight ${t.title}`}>
                {service.title}
              </span>
              <span className={`mt-2 block max-w-[42ch] text-[0.98rem] leading-relaxed ${t.body}`}>
                {service.body}
              </span>
              <span className={`mt-5 inline-flex items-center gap-2 text-[0.92rem] font-medium ${t.link}`}>
                Learn more
                <Ico
                  name="arrow"
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
