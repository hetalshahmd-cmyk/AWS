import Image from "next/image";
import { photos, type PhotoKey } from "@/lib/photos";
import { locations, officeHours, site } from "@/lib/site";
import Ico from "./Ico";
import { BookButton, Button } from "./ui";

/**
 * Arizona scenery for each card's header, in the order of `locations`. These
 * are landscapes of the area, not photographs of the offices themselves.
 */
const HEADER: { key: PhotoKey; position: string }[] = [
  { key: "phoenixAerial", position: "50% 55%" },
  { key: "valleyView", position: "50% 70%" },
];

/** The two offices as cards: photo, address, hours, call, directions, book. */
export default function Locations() {
  return (
    <div className="grid gap-6 min-[860px]:grid-cols-2">
      {locations.map((location, index) => {
        const header = HEADER[index % HEADER.length];
        return (
          <article
            key={location.name}
            className="reveal group flex flex-col overflow-hidden rounded-[28px] border border-mist bg-white transition duration-500 hover:shadow-lift"
          >
            <div className="relative h-52 overflow-hidden min-[860px]:h-60">
              <Image
                src={photos[header.key].src}
                alt={photos[header.key].alt}
                fill
                sizes="(min-width: 860px) 50vw, 100vw"
                placeholder="blur"
                className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.05]"
                style={{ objectPosition: header.position }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(180deg,rgba(29,22,25,.05)_40%,rgba(29,22,25,.55)_100%)]"
              />
              <p className="absolute bottom-5 left-[clamp(1.5rem,3.5vw,2.25rem)] text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-white/85">
                Office {String(index + 1).padStart(2, "0")}
              </p>
            </div>

            <div className="relative flex flex-1 flex-col p-[clamp(1.5rem,3.5vw,2.25rem)]">
              <span className="absolute -top-7 right-[clamp(1.5rem,3.5vw,2.25rem)] grid h-14 w-14 place-items-center rounded-full bg-wine text-white shadow-lift">
                <Ico name="pin" className="h-6 w-6" />
              </span>
              <h3 className="font-display text-[clamp(1.7rem,3vw,2.1rem)] leading-tight text-plum">
                {location.name}
              </h3>
              <address className="mt-3 text-[1.05rem] not-italic leading-relaxed text-plum-soft">
                {location.address[0]}
                <br />
                {location.address[1]}
              </address>

              <dl className="mt-6 grid grid-cols-2 gap-3">
                {officeHours.map((row) => (
                  <div key={row.days} className="rounded-2xl bg-ivory px-4 py-3">
                    <dt className="text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-stone">
                      {row.days}
                    </dt>
                    <dd className="mt-1 font-medium text-plum">{row.hours}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8 flex flex-wrap gap-2.5 min-[860px]:mt-auto min-[860px]:pt-8">
                <BookButton size="sm" />
                <Button
                  href={site.phoneHref}
                  variant="line"
                  size="sm"
                  icon="phone"
                  ariaLabel={`Call the ${location.name}`}
                >
                  Call
                </Button>
                <Button
                  href={location.maps}
                  variant="line"
                  size="sm"
                  icon="external"
                  ariaLabel={`Directions to the ${location.name} (opens Google Maps)`}
                >
                  Directions
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
