import { locations, officeHours, site } from "@/lib/site";
import Ico from "./Ico";
import { BookButton, Button } from "./ui";

/** The two offices as cards: address, hours, call, directions, book. */
export default function Locations() {
  return (
    <div className="grid gap-5 min-[860px]:grid-cols-2">
      {locations.map((location, index) => (
        <article
          key={location.name}
          className="reveal shadow-soft flex flex-col rounded-[28px] border border-mist bg-white p-[clamp(1.5rem,3.5vw,2.5rem)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-stone">
                Office {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 font-display text-[clamp(1.6rem,3vw,2rem)] leading-tight text-plum">
                {location.name}
              </h3>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-wine-soft text-wine">
              <Ico name="pin" className="h-[22px] w-[22px]" />
            </span>
          </div>

          <address className="mt-5 text-[1.05rem] not-italic leading-relaxed text-plum-soft">
            {location.address[0]}
            <br />
            {location.address[1]}
          </address>

          <dl className="mt-6 space-y-2 border-t border-mist pt-5 text-[0.95rem]">
            {officeHours.map((row) => (
              <div key={row.days} className="flex justify-between gap-4">
                <dt className="text-plum-soft">{row.days}</dt>
                <dd className="font-medium text-plum">{row.hours}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-2.5 pt-1 min-[860px]:mt-auto min-[860px]:pt-8">
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
        </article>
      ))}
    </div>
  );
}
