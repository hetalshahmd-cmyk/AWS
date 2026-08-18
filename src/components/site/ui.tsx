import Link from "next/link";
import PhoneLink from "@/components/analytics/PhoneLink";
import Ico, { type IcoName } from "./Ico";

const BASE =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-transparent font-semibold transition hover:-translate-y-0.5";
const SIZES = {
  md: "px-6 py-3 text-[16px]",
  sm: "px-[1.1em] py-[0.6em] text-[15px]",
};
const VARIANTS = {
  primary: "bg-wine text-white shadow-[0_10px_24px_-12px_#7c2c3e] hover:bg-wine-deep",
  line: "border-wine bg-transparent text-wine hover:bg-wine hover:text-white",
};

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: IcoName;
  external?: boolean;
  className?: string;
};

export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  icon,
  external,
  className = "",
}: ButtonProps) {
  const content = (
    <>
      {icon && <Ico name={icon} className="h-[1.15em] w-[1.15em]" />}
      {children}
    </>
  );
  const classes = `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`;

  // Every call CTA on the site routes through here, which makes this the one
  // place worth instrumenting for phone intent.
  if (href.startsWith("tel:")) {
    return (
      <PhoneLink href={href} className={classes}>
        {content}
      </PhoneLink>
    );
  }

  if (external || href.startsWith("http")) {
    return (
      <a
        href={href}
        className={classes}
        {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}

export function BookButton(props: Omit<ButtonProps, "href" | "children">) {
  return (
    <Button href="/book" icon="cal" {...props}>
      Book Now
    </Button>
  );
}

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
    <section id={id} className={tone === "shell" ? "bg-shell" : ""}>
      <div className="mx-auto max-w-[1120px] px-[clamp(15px,4vw,40px)] py-[clamp(2.6rem,6vw,4.6rem)]">
        {children}
      </div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  body,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  center?: boolean;
}) {
  return (
    <div className={`mb-9 max-w-[640px] ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow && (
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-wine">{eyebrow}</p>
      )}
      <h2 className="mt-2 font-display text-[clamp(1.7rem,3.4vw,2.5rem)] font-semibold leading-[1.12]">
        {title}
      </h2>
      {body && <p className="mt-3 text-[1.05rem] text-plum-soft">{body}</p>}
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1.5 text-[0.9rem] font-semibold text-sage-ink">
      {children}
    </span>
  );
}
