import type { providers } from "@/lib/site";

type Provider = (typeof providers)[number];

const SIZES = {
  sm: "h-14 w-14 text-[1.15rem]",
  md: "h-24 w-24 text-[2rem]",
  lg: "h-32 w-32 text-[2.6rem]",
};

/**
 * Monogram portrait. Deliberately not a stock headshot: a stranger's face
 * beside a real clinician's name would misrepresent who patients will see.
 * Swap in a real photo here once the practice has one.
 */
export default function ProviderAvatar({
  provider,
  size = "md",
}: {
  provider: Provider;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br ${provider.avatar} font-display text-white ring-4 ring-white ${SIZES[size]}`}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,.28),transparent_60%)]" />
      <span className="relative tracking-[0.02em]">{provider.initials}</span>
    </span>
  );
}
