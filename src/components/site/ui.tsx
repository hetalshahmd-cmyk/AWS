import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import BookLink from "@/components/analytics/BookLink";
import PhoneLink from "@/components/analytics/PhoneLink";
import { site } from "@/lib/site";
import Ico, { type IcoName } from "./Ico";

/* ------------------------------------------------------------- buttons -- */

const BASE =
  "focus-ring group/btn inline-flex min-h-11 items-center justify-center gap-2 rounded-full border font-medium tracking-[0.01em] transition duration-300 ease-[cubic-bezier(.22,1,.36,1)] active:scale-[0.98]";
const SIZES = {
  lg: "px-7 py-3.5 text-[1rem]",
  md: "px-6 py-3 text-[0.97rem]",
  sm: "px-4.5 py-2 text-[0.92rem]",
};
const VARIANTS = {
  primary:
    "border-transparent bg-wine text-white shadow-[0_12px_28px_-14px_rgba(124,44,62,.9)] hover:bg-wine-deep hover:shadow-[0_18px_34px_-16px_rgba(124,44,62,.95)]",
  line: "border-plum/20 bg-transparent text-plum hover:border-plum hover:bg-plum hover:text-white",
  // For buttons sitting on photography or the dark footer.
  light: "border-transparent bg-white text-plum hover:bg-ivory",
  // Dark-on-ivory on phones, white-on-photo from 900px — for the home hero.
  hero: "border-plum/20 bg-transparent text-plum hover:border-plum hover:bg-plum hover:text-white min-[900px]:border-white/50 min-[900px]:text-white min-[900px]:backdrop-blur-sm min-[900px]:hover:border-white min-[900px]:hover:bg-white min-[900px]:hover:text-plum",
  ghost: "border-white/45 bg-white/5 text-white backdrop-blur-sm hover:border-white hover:bg-white hover:text-plum",
};

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: IcoName;
  /** Trailing arrow that nudges on hover — for "go somewhere" links. */
  arrow?: boolean;
  external?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  icon,
  arrow,
  external,
  className = "",
  ariaLabel,
}: ButtonProps) {
  const content = (
    <>
      {icon && <Ico name={icon} className="h-[1.1em] w-[1.1em]" />}
      {children}
      {arrow && (
        <Ico
          name="arrow"
          className="h-[1.05em] w-[1.05em] transition-transform duration-300 group-hover/btn:translate-x-1"
        />
      )}
    </>
  );
  const classes = `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`;

  // Every call CTA on the site routes through here, which makes this the one
  // place worth instrumenting for phone intent.
  if (href.startsWith("tel:")) {
    return (
      <PhoneLink href={href} className={classes} ariaLabel={ariaLabel}>
        {content}
      </PhoneLink>
    );
  }

  // Booking leaves this domain now, so the click is the last thing we can
  // measure. Same reasoning as the phone branch above.
  if (href === site.bookingUrl) {
    return (
      <BookLink href={href} className={classes} ariaLabel={ariaLabel}>
        {content}
      </BookLink>
    );
  }

  if (external || href.startsWith("http")) {
    return (
      <a
        href={href}
        className={classes}
        aria-label={ariaLabel}
        {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} aria-label={ariaLabel}>
      {content}
    </Link>
  );
}

export function BookButton({
  label = "Book Now",
  ...props
}: Omit<ButtonProps, "href" | "children"> & { label?: string }) {
  return (
    <Button href={site.bookingUrl} icon="cal" {...props}>
      {label}
    </Button>
  );
}

/** The two actions every section ends on: book, or call. */
export function CallAndBook({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-3 max-[480px]:flex-col ${className}`}>
      <BookButton size="lg" variant={tone === "dark" ? "light" : "primary"} />
      <Button
        href={site.phoneHref}
        variant={tone === "dark" ? "ghost" : "line"}
        size="lg"
        icon="phone"
      >
        Call {site.phone}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------- layout -- */

export function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1240px] px-[clamp(20px,5vw,48px)] ${className}`}>
      {children}
    </div>
  );
}

const TONES = {
  white: "bg-white",
  ivory: "bg-ivory",
  sand: "bg-shell",
  night: "bg-night text-white",
};

export function Section({
  children,
  tone = "white",
  id,
  className = "",
  labelledBy,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  id?: string;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${TONES[tone]} ${className}`}>
      <Container className="py-[clamp(4rem,9vw,7.5rem)]">{children}</Container>
    </section>
  );
}

/** Kept for pages that still use the old name. */
export function Band({
  children,
  tone = "white",
  id,
}: {
  children: React.ReactNode;
  tone?: "white" | "shell";
  id?: string;
}) {
  return (
    <Section tone={tone === "shell" ? "sand" : "white"} id={id}>
      {children}
    </Section>
  );
}

/* ---------------------------------------------------------- typography -- */

export function Eyebrow({
  children,
  light = false,
  className = "",
}: {
  children: React.ReactNode;
  light?: boolean;
  className?: string;
}) {
  return (
    <p
      className={`inline-flex items-center gap-3 text-[0.75rem] font-semibold uppercase tracking-[0.22em] ${
        light ? "text-white/80" : "text-wine"
      } ${className}`}
    >
      <span aria-hidden="true" className={`h-px w-7 ${light ? "bg-white/60" : "bg-wine/60"}`} />
      {children}
    </p>
  );
}

export function SectionHead({
  eyebrow,
  title,
  body,
  center = false,
  light = false,
  id,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  center?: boolean;
  light?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <div
      className={`reveal mb-[clamp(2.25rem,5vw,3.5rem)] max-w-[680px] ${
        center ? "mx-auto text-center" : ""
      } ${className}`}
    >
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      <h2
        id={id}
        className={`mt-4 font-display text-[clamp(2rem,4.2vw,3.1rem)] font-normal leading-[1.08] tracking-[-0.015em] ${
          light ? "text-white" : "text-plum"
        }`}
      >
        {title}
      </h2>
      {body && (
        <p
          className={`mt-5 text-[clamp(1.02rem,1.4vw,1.12rem)] leading-relaxed ${
            light ? "text-white/75" : "text-plum-soft"
          } ${center ? "mx-auto max-w-[56ch]" : "max-w-[56ch]"}`}
        >
          {body}
        </p>
      )}
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1.5 text-[0.88rem] font-medium text-sage-ink">
      {children}
    </span>
  );
}

/** A round icon tile — the one visual rhythm shared by every card. */
export function IconTile({
  name,
  tone = "wine",
  size = "md",
}: {
  name: IcoName;
  tone?: "wine" | "sage" | "light";
  size?: "sm" | "md";
}) {
  const tones = {
    wine: "bg-wine-soft text-wine",
    sage: "bg-sage-soft text-sage-ink",
    light: "bg-white/10 text-white",
  };
  const sizes = { sm: "h-10 w-10", md: "h-12 w-12" };
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${sizes[size]} ${tones[tone]}`}>
      <Ico name={name} className={size === "sm" ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]"} />
    </span>
  );
}

/* -------------------------------------------------------------- images -- */

/**
 * A rounded photograph that eases into view. `sizes` matters: it is what lets
 * the optimizer send a phone a 640px file instead of the 2000px original.
 */
export function Photo({
  src,
  alt,
  sizes,
  className = "",
  imgClassName = "",
  position = "center",
  preload = false,
}: {
  src: StaticImageData;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  position?: string;
  preload?: boolean;
}) {
  return (
    <div className={`reveal-image relative overflow-hidden rounded-[28px] bg-sand ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        placeholder="blur"
        preload={preload}
        className={`object-cover ${imgClassName}`}
        style={{ objectPosition: position }}
      />
    </div>
  );
}

/**
 * The banner at the top of every inner page: editorial copy beside a photo.
 * Holds the page's only h1.
 */
export function PageHeader({
  eyebrow,
  title,
  body,
  image,
  imageAlt,
  imagePosition,
  children,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  image: StaticImageData;
  imageAlt: string;
  imagePosition?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-ivory">
      <Container className="grid items-center gap-10 pb-[clamp(3rem,7vw,5.5rem)] pt-[clamp(2.5rem,6vw,4.5rem)] min-[900px]:grid-cols-[1fr_1.05fr] min-[900px]:gap-16">
        <div className="reveal">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 font-display text-[clamp(2.5rem,5.6vw,4.4rem)] font-normal leading-[1.02] tracking-[-0.02em] text-plum">
            {title}
          </h1>
          {body && (
            <p className="mt-6 max-w-[48ch] text-[clamp(1.05rem,1.5vw,1.18rem)] leading-relaxed text-plum-soft">
              {body}
            </p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </div>
        <Photo
          src={image}
          alt={imageAlt}
          sizes="(min-width: 900px) 52vw, 100vw"
          position={imagePosition}
          preload
          className="aspect-[4/3] w-full min-[900px]:aspect-[5/4]"
        />
      </Container>
    </section>
  );
}

/** Image beside content — alternates sides with `reverse`. */
export function MediaSplit({
  image,
  imageAlt,
  imagePosition,
  reverse = false,
  children,
}: {
  image: StaticImageData;
  imageAlt: string;
  imagePosition?: string;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 min-[900px]:grid-cols-2 min-[900px]:gap-[clamp(3rem,7vw,6rem)]">
      <Photo
        src={image}
        alt={imageAlt}
        sizes="(min-width: 900px) 50vw, 100vw"
        position={imagePosition}
        className={`aspect-[4/3] w-full min-[900px]:aspect-[4/5] ${reverse ? "min-[900px]:order-2" : ""}`}
      />
      <div className="reveal">{children}</div>
    </div>
  );
}
