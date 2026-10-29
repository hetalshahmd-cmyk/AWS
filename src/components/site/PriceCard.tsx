import Ico from "@/components/site/Ico";
import type { Plan } from "@/lib/models";

/** One accent per price category, matched on the tag an admin sets. */
const TAG_ACCENT: Record<string, { chip: string; glow: string }> = {
  "New Patient": { chip: "bg-wine-soft text-wine", glow: "bg-wine-soft" },
  Returning: { chip: "bg-sand text-plum", glow: "bg-sand" },
  Imaging: { chip: "bg-sage-soft text-sage-ink", glow: "bg-sage-soft" },
  "Birth Control": { chip: "bg-wine-soft text-wine-deep", glow: "bg-wine-soft" },
  default: { chip: "bg-ivory text-plum", glow: "bg-sand" },
};

/**
 * A price card exactly as patients see it on /pricing. Admin → Pricing uses
 * the same card, so what the front desk sees is what goes live.
 */
export default function PriceCard({
  price,
  index,
  footer,
  reveal = false,
}: {
  price: Pick<Plan, "tag" | "tagIcon" | "amount" | "title" | "body">;
  index: number;
  /** Right of the price: "Book" on the site, Edit/Delete in the admin. */
  footer: (featured: boolean) => React.ReactNode;
  /** Scroll-in animation, only on the public site. */
  reveal?: boolean;
}) {
  // The first card is the new-patient visit in the default ordering; it gets
  // the dark feature treatment whatever an admin calls it.
  const featured = index === 0;
  const accent = TAG_ACCENT[price.tag] ?? TAG_ACCENT.default;
  return (
    <li
      className={`${reveal ? "reveal " : ""}group relative flex flex-col overflow-hidden rounded-[28px] p-[clamp(1.75rem,3vw,2.25rem)] transition duration-500 hover:-translate-y-1.5 ${
        featured
          ? "bg-night text-white shadow-lift min-[1060px]:row-span-1"
          : "border border-mist bg-white hover:shadow-lift"
      }`}
    >
      {/* Coloured corner glow — one hue per category. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-2xl transition-opacity duration-500 ${
          featured ? "bg-wine/60 opacity-100" : `${accent.glow} opacity-70 group-hover:opacity-100`
        }`}
      />
      <div className="relative flex items-center justify-between gap-3">
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.14em] ${
            featured ? "bg-white/10 text-white" : accent.chip
          }`}
        >
          <Ico name={price.tagIcon} className="h-3.5 w-3.5" />
          {price.tag}
        </span>
        <span
          className={`font-display text-[0.95rem] ${featured ? "text-white/50" : "text-stone"}`}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3
        className={`relative mt-8 font-display text-[1.55rem] leading-tight ${featured ? "text-white" : "text-plum"}`}
      >
        {price.title}
      </h3>
      <p
        className={`relative mt-2 flex-1 text-[0.98rem] leading-relaxed ${featured ? "text-white/70" : "text-plum-soft"}`}
      >
        {price.body}
      </p>
      <div
        className={`relative mt-8 flex items-end justify-between gap-4 border-t pt-6 ${featured ? "border-white/15" : "border-plum/10"}`}
      >
        <p
          className={`font-display text-[3.6rem] leading-none tabular-nums tracking-[-0.02em] ${
            featured ? "text-[#f3d7dd]" : "text-wine"
          }`}
        >
          {price.amount}
        </p>
        {footer(featured)}
      </div>
    </li>
  );
}
