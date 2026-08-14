import type { Metadata } from "next";
import Link from "next/link";
import { getStats } from "@/lib/repo";
import { formatShort } from "@/lib/availability";

export const metadata: Metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let stats;
  try {
    stats = await getStats();
  } catch (error) {
    return (
      <div className="rounded-2xl border border-wine/30 bg-wine-soft p-6">
        <h1 className="font-display text-[1.4rem] font-semibold text-wine-deep">
          Can&apos;t reach MongoDB
        </h1>
        <p className="mt-2 text-[15px] text-plum">
          Check <code className="rounded bg-white px-1.5 py-0.5">MONGODB_URI</code> in{" "}
          <code className="rounded bg-white px-1.5 py-0.5">.env.local</code> and that the server is
          running.
        </p>
        <p className="mt-2 text-[13px] text-plum-soft">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const tiles = [
    { label: "Upcoming bookings", value: stats.bookingsUpcoming, href: "/admin/bookings" },
    { label: "Bookings all time", value: stats.bookingsTotal, href: "/admin/bookings" },
    { label: "Open slots ahead", value: stats.slotsOpen, href: "/admin/slots" },
    { label: "Slots ahead (total)", value: stats.slotsTotal, href: "/admin/slots" },
    { label: "Cancelled", value: stats.bookingsCancelled, href: "/admin/bookings" },
    { label: "Pricing plans", value: stats.plans, href: "/admin/pricing" },
  ];

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Dashboard</h1>
      <p className="mt-1 text-plum-soft">Everything patients see is managed from here.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="focus-ring rounded-2xl border border-mist bg-white p-5 transition hover:-translate-y-0.5 hover:border-wine"
          >
            <p className="font-display text-[2.2rem] leading-none tabular-nums text-wine">
              {tile.value}
            </p>
            <p className="mt-2 text-[14px] text-plum-soft">{tile.label}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 font-display text-[1.3rem] font-semibold">Latest bookings</h2>
      {stats.recent.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-mist bg-white p-6 text-plum-soft">
          No bookings yet. Add slots under{" "}
          <Link href="/admin/slots" className="font-semibold text-wine link-underline">
            Appointment slots
          </Link>{" "}
          so patients can book.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-mist overflow-hidden rounded-2xl border border-mist bg-white">
          {stats.recent.map((booking) => (
            <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-[190px]">
                <p className="font-semibold">
                  {booking.patient.firstName} {booking.patient.lastName}
                </p>
                <p className="text-[13px] text-plum-soft">{booking.patient.email}</p>
              </div>
              <p className="text-[14px]">
                {formatShort(booking.date)} at {booking.time.toUpperCase()}
              </p>
              <p className="text-[14px] text-plum-soft">{booking.reason}</p>
              <span
                className={`ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                  booking.status === "confirmed"
                    ? "bg-sage-soft text-sage-ink"
                    : "bg-wine-soft text-wine-deep"
                }`}
              >
                {booking.status === "confirmed" ? "Confirmed" : "Cancelled"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
