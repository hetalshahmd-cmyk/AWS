import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import BookingCard from "@/components/BookingCard";
import ProfilePanel from "@/components/ProfilePanel";
import { BookingProvider } from "@/components/booking-context";
import { getUserSession } from "@/lib/auth";
import { practice } from "@/lib/practice";
import { toIso } from "@/lib/availability";

export const metadata: Metadata = {
  title: `Book an appointment — ${practice.name}`,
  description: `Book an appointment for free with ${practice.name}, ${practice.specialty} at ${practice.addressLine}.`,
};

// Booking needs an account, so this page is per-request anyway.
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

/**
 * Rebuilds the incoming query string so the sign-in detour returns the visitor
 * to the exact URL they arrived on. Ad traffic lands here carrying `fbclid` and
 * `utm_*`; dropping them here loses the click for good, because the pixel only
 * ever sees the page it is finally rendered on.
 */
function queryOf(search: Search): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) params.set(key, first);
  }
  return params.toString();
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  // Signed-out visitors go to the login page and come straight back here —
  // query string intact, so the ad click survives the round trip.
  if (!(await getUserSession())) {
    const query = queryOf(await searchParams);
    const back = query ? `/book?${query}` : "/book";
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const todayIso = toIso(new Date());

  return (
    <BookingProvider todayIso={todayIso}>
      <div className="min-h-screen bg-cream text-ink">
        <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
          <Link
            href="/"
            className="focus-ring text-[15px] font-medium text-ink-soft link-underline"
          >
            ← Back to {practice.name}
          </Link>

          <div className="mt-6 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,556px)] lg:gap-14">
            <div>
              <div className="flex gap-5">
                <Image
                  src="/logo.png"
                  alt={practice.photoAlt}
                  width={120}
                  height={120}
                  priority
                  className="h-24 w-24 shrink-0 rounded-xl border border-line bg-white object-contain p-1.5"
                />
                <div className="pt-1">
                  <h1 className="text-[30px] font-bold leading-tight tracking-tight">
                    {practice.name}
                  </h1>
                  <p className="mt-1 text-[16px] font-medium text-ink-soft">
                    {practice.specialty}
                  </p>
                  <p className="mt-0.5 text-[16px] text-ink-soft">{practice.addressLine}</p>
                </div>
              </div>

              <div className="mt-8">
                <ProfilePanel />
              </div>
            </div>

            <div className="lg:sticky lg:top-6">
              <BookingCard />
            </div>
          </div>
        </div>
      </div>
    </BookingProvider>
  );
}
