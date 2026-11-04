import Link from "next/link";
import Ico from "./Ico";

/**
 * "Have insurance? See the plans we accept" — where the plan list used to be
 * on the Home and Self Pay pages. The plans themselves are on /insurance.
 */
export default function InsuranceLink() {
  return (
    <div className="reveal flex flex-wrap items-center justify-between gap-5 rounded-[28px] border border-mist bg-white p-[clamp(1.5rem,3vw,2rem)]">
      <p className="flex items-center gap-3 font-display text-[clamp(1.35rem,2.4vw,1.75rem)] leading-tight text-plum">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wine-soft text-wine">
          <Ico name="shield" className="h-5 w-5" />
        </span>
        Have insurance?
      </p>
      <Link
        href="/insurance"
        className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-full bg-wine px-6 text-[15px] font-medium text-white transition hover:bg-wine-deep"
      >
        See the plans we accept
        <Ico name="arrow" className="h-4 w-4" />
      </Link>
    </div>
  );
}
