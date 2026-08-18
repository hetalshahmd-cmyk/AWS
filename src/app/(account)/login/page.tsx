import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";
import { safeNext } from "@/components/auth/safe-next";
import { site } from "@/lib/site";
import PhoneLink from "@/components/analytics/PhoneLink";

export const metadata: Metadata = {
  title: `Log in — ${site.name}`,
  description: "Sign in to book an appointment or manage the ones you have.",
};

/**
 * `next` is read here on the server rather than with useSearchParams inside the
 * form. That keeps the whole page server-rendered: a first-time visitor arriving
 * from an ad sees a real form in the very first response instead of an empty
 * shell waiting on JavaScript.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null));
  const booking = next.startsWith("/book");

  return (
    <div className="mx-auto w-full max-w-md px-5 py-[clamp(2.5rem,6vw,4.5rem)]">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] font-semibold leading-tight">
        {booking ? "Log in to book" : "Log in"}
      </h1>
      <p className="mt-2 text-plum-soft">
        {booking
          ? "Appointments are held in your name, so we need an account first. It takes about a minute — or call us and we will book it for you."
          : "See your upcoming visits, and cancel or reschedule in a couple of clicks."}
      </p>
      <AuthForm next={next} />

      {booking && (
        <p className="mt-6 rounded-lg border border-mist bg-shell px-3.5 py-3 text-[15px] text-plum-soft">
          Prefer not to make an account?{" "}
          <PhoneLink href={site.phoneHref} className="font-semibold text-wine link-underline">
            Call {site.phone}
          </PhoneLink>{" "}
          and we will book your appointment over the phone.
        </p>
      )}
    </div>
  );
}
