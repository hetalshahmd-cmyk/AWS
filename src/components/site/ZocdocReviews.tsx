import Ico from "./Ico";

/**
 * "★ 4.93 · 15 reviews on Zocdoc" — the rating and count as Zocdoc shows them
 * on the provider's listing, linking there when a URL is given. Renders
 * nothing when Zocdoc shows no reviews.
 */
export default function ZocdocReviews({
  count,
  rating = null,
  href,
  className = "",
}: {
  count: number | null;
  rating?: number | null;
  href?: string;
  className?: string;
}) {
  if (!count) return null;
  const body = (
    <>
      <Ico name="star" className="h-3.5 w-3.5 fill-current text-[#E0607E]" />
      {rating !== null && <span className="font-semibold text-plum">{rating.toFixed(2)}</span>}
      <span>
        {rating !== null && "· "}
        {count} reviews on Zocdoc
      </span>
    </>
  );
  const classes = `inline-flex items-center gap-1.5 text-[0.82rem] text-plum-soft ${className}`;
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${classes} focus-ring rounded transition hover:text-plum hover:underline`}
    >
      {body}
    </a>
  ) : (
    <p className={classes}>{body}</p>
  );
}
