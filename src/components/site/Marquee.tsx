import Ico from "./Ico";

/**
 * A slow ribbon of short phrases. The list is rendered twice so the loop is
 * seamless; the copy is hidden from screen readers so it is announced once.
 * With reduced motion the track does not move and simply wraps.
 */
export default function Marquee({ items, label }: { items: readonly string[]; label: string }) {
  const row = (hidden: boolean) => (
    <ul
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-10 pr-10 motion-reduce:w-full motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-3"
    >
      {items.map((item) => (
        <li
          key={item}
          className="flex items-center gap-10 whitespace-nowrap font-display text-[clamp(1.15rem,2vw,1.5rem)] text-plum"
        >
          {item}
          <Ico name="star" className="h-4 w-4 shrink-0 fill-wine/15 text-wine" />
        </li>
      ))}
    </ul>
  );

  return (
    <section
      aria-label={label}
      className="marquee overflow-hidden border-y border-mist bg-white py-6 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
    >
      <div className="marquee-track flex w-max motion-reduce:w-full">
        {row(false)}
        <div className="motion-reduce:hidden">{row(true)}</div>
      </div>
    </section>
  );
}
