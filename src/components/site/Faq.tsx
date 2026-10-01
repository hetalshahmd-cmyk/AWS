import { faqs } from "@/lib/site";

export default function Faq() {
  return (
    <div className="reveal border-t border-mist">
      {faqs.map((faq, index) => (
        <details key={faq.q} open={index === 0} className="group border-b border-mist">
          <summary className="focus-ring flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-6 font-display text-[clamp(1.2rem,2vw,1.4rem)] leading-snug text-plum transition-colors hover:text-wine [&::-webkit-details-marker]:hidden">
            {faq.q}
            {/* Plus that turns into a minus. */}
            <span
              aria-hidden="true"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-mist transition-colors group-open:border-wine group-open:bg-wine"
            >
              <span className="absolute h-px w-3.5 bg-plum transition-colors group-open:bg-white" />
              <span className="absolute h-3.5 w-px bg-plum transition-transform duration-300 group-open:scale-y-0" />
            </span>
          </summary>
          <p className="max-w-[62ch] pb-7 pr-14 text-[1.03rem] leading-relaxed text-plum-soft">
            {faq.a}
          </p>
        </details>
      ))}
    </div>
  );
}
