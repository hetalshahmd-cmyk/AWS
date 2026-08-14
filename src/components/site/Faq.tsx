import { faqs } from "@/lib/site";
import Ico from "./Ico";

export default function Faq() {
  return (
    <div className="max-w-[760px]">
      {faqs.map((faq, index) => (
        <details
          key={faq.q}
          open={index === 0}
          className="border-b border-mist [&[open]_.chev]:rotate-180"
        >
          <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[1.06rem] font-semibold [&::-webkit-details-marker]:hidden">
            {faq.q}
            <Ico name="chev" className="chev h-[1.15em] w-[1.15em] shrink-0 text-wine transition" />
          </summary>
          <p className="max-w-[66ch] pb-5 text-plum-soft">{faq.a}</p>
        </details>
      ))}
    </div>
  );
}
