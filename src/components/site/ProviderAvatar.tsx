import Image from "next/image";
import { providerPhotos } from "@/lib/photos";
import type { Provider } from "@/lib/providers";

const SIZES = {
  xs: { box: "h-9 w-9 text-[0.8rem]", px: 36 },
  sm: { box: "h-14 w-14 text-[1.15rem]", px: 56 },
  md: { box: "h-24 w-24 text-[2rem]", px: 96 },
  lg: { box: "h-28 w-28 text-[2.4rem]", px: 112 },
};

/**
 * The provider's own headshot, falling back to a monogram in their colour if
 * no photo is on file.
 */
export default function ProviderAvatar({
  provider,
  size = "md",
}: {
  provider: Provider;
  size?: keyof typeof SIZES;
}) {
  const { box, px } = SIZES[size];
  // An uploaded headshot first, then a built-in one, else the monogram.
  const photo =
    provider.photoUrl ??
    (provider.photo && provider.photo in providerPhotos
      ? providerPhotos[provider.photo as keyof typeof providerPhotos]
      : null);

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br ${provider.avatar} font-display text-white ring-4 ring-white ${box}`}
    >
      {photo ? (
        <Image
          src={photo}
          // The name is always printed right beside the photo.
          alt=""
          width={px}
          height={px}
          sizes={`${px}px`}
          unoptimized={typeof photo === "string"}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,.28),transparent_60%)]"
          />
          <span aria-hidden="true" className="relative tracking-[0.02em]">
            {provider.initials}
          </span>
        </>
      )}
    </span>
  );
}
