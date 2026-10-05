import Ico from "./Ico";

/**
 * "★★★★★ 15 reviews on Zocdoc" — the stars and count as Zocdoc displays them
 * on the provider's listing. Renders nothing when Zocdoc shows no reviews.
 */
export default function ZocdocReviews({
  count,
  className = "",
}: {
  count: number | null;
  className?: string;
}) {
  if (!count) return null;
  return (
    <p className={`inline-flex items-center gap-1.5 text-[0.82rem] text-plum-soft ${className}`}>
      <span className="flex text-[#E0607E]" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Ico key={index} name="star" className="h-3.5 w-3.5 fill-current" />
        ))}
      </span>
      <span>
        {count} reviews on Zocdoc
      </span>
    </p>
  );
}
