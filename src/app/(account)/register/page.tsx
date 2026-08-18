import type { Metadata } from "next";
import RegisterForm from "@/components/auth/RegisterForm";
import { safeNext } from "@/components/auth/safe-next";
import { site } from "@/lib/site";
import PhoneLink from "@/components/analytics/PhoneLink";

export const metadata: Metadata = {
  title: `Create an account — ${site.name}`,
  description: "Create an account to book and manage appointments online.",
};

/**
 * Like the login page, `next` is resolved on the server so the first response
 * already contains the form. Most paid traffic lands here, so a blank first
 * paint is expensive.
 */
export default async function RegisterPage({
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
        {booking ? "Create an account to book" : "Create your account"}
      </h1>
      <p className="mt-2 text-plum-soft">
        {booking
          ? "Three quick steps: your name and email, a code we email you, then a password. Then you pick your appointment time."
          : "We verify your email with a code first. You'll be signed in straight away — bookings you already made with this email are added automatically."}
      </p>
      <RegisterForm next={next} />

      {booking && (
        <p className="mt-6 rounded-lg border border-mist bg-shell px-3.5 py-3 text-[15px] text-plum-soft">
          In a hurry, or would rather not make an account?{" "}
          <PhoneLink href={site.phoneHref} className="font-semibold text-wine link-underline">
            Call {site.phone}
          </PhoneLink>{" "}
          — walk-ins are welcome too.
        </p>
      )}
    </div>
  );
}
