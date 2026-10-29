import { requireAdminPage } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { CapacityChart, Meter, WeeksChart } from "@/components/admin/DashboardCharts";
import RefreshingBookButton from "@/components/admin/RefreshingBookButton";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import { formatLong, formatShort } from "@/lib/availability";
import { getDashboard } from "@/lib/repo";
import { officeById, providerById, shortProviderName } from "@/lib/scheduling";

export const metadata: Metadata = { title: "Dashboard — Admin" };
export const dynamic = "force-dynamic";

const pct = (value: number) => `${Math.round(value * 100)}%`;

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-mist bg-white p-5 sm:p-6 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-plum">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string | number;
  note: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="focus-ring group rounded-2xl border border-mist bg-white p-5 transition hover:border-wine/40 hover:shadow-[0_10px_30px_-18px_rgba(92,30,45,.35)]"
    >
      <p className="text-[12px] font-semibold uppercase tracking-wide text-plum-soft">{label}</p>
      <p className="mt-2 font-display text-[2.6rem] leading-none tabular-nums text-plum">{value}</p>
      <p className="mt-2 text-[13px] text-plum-soft">{note}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  await requireAdminPage();
  let data;
  try {
    data = await getDashboard();
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
  const { kpis } = data;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-wine">
            {formatLong(data.today)}
          </p>
          <h1 className="mt-1 font-display text-[2rem] font-semibold leading-tight">Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/slots"
            className="focus-ring inline-flex items-center rounded-lg border border-line-strong bg-white px-4 py-2.5 text-[15px] font-semibold transition hover:bg-shell"
          >
            Week plan & slots
          </Link>
          <RefreshingBookButton />
        </div>
      </div>

      {/* ------------------------------------------------------- KPIs -- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Today"
          value={kpis.todayCount}
          note={`${kpis.todayCheckedIn} of ${kpis.todayCount} checked in`}
          href="/admin/bookings"
        />
        <Kpi
          label="Next 7 days"
          value={kpis.next7}
          note="Confirmed appointments"
          href="/admin/bookings"
        />
        <Kpi
          label="Open times · 14 days"
          value={kpis.openNext14}
          note={`${pct(kpis.fillNext14)} of bookable times are taken`}
          href="/admin/slots"
        />
        <Kpi
          label="Visits · last 30 days"
          value={kpis.completed30}
          note={`${kpis.newPatients30} new patients · ${pct(kpis.cancelRate30)} cancelled`}
          href="/admin/bookings"
        />
      </div>

      {/* ----------------------------------------------------- charts -- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Next 14 days — booked vs. open">
          <CapacityChart days={data.ahead} today={data.today} />
        </Panel>
        <Panel title="Visits per week — last 8 weeks">
          <WeeksChart weeks={data.weeks} />
        </Panel>
      </div>

      {/* ------------------------------------- today + providers -- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Today's schedule"
          action={
            <span className="text-[13px] text-plum-soft">{data.todays.length} appointments</span>
          }
        >
          {data.todays.length === 0 ? (
            <p className="rounded-xl bg-shell px-4 py-6 text-center text-[14px] text-plum-soft">
              No appointments today.
            </p>
          ) : (
            <ul className="-mx-2 divide-y divide-mist">
              {data.todays.map((booking) => {
                const provider = providerById(booking.providerId);
                const checkedIn = Boolean(booking.intake?.submittedAt);
                return (
                  <li key={booking.id}>
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="focus-ring flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-shell"
                    >
                      <span className="w-[68px] shrink-0 font-display text-[1.05rem] tabular-nums text-plum">
                        {booking.time}
                      </span>
                      {provider && <ProviderAvatar provider={provider} size="xs" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">
                          {booking.patient.firstName} {booking.patient.lastName}
                          {booking.patientType === "new" && (
                            <span className="ml-1.5 rounded bg-wine-soft px-1 py-0.5 text-[10px] font-bold uppercase text-wine-deep">
                              New
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[12px] text-plum-soft">
                          {shortProviderName(booking.providerId)} · {booking.reason} ·{" "}
                          {officeById(booking.officeId)?.area ?? "—"}
                        </span>
                      </span>
                      {/* Phones get the short form so the patient's name has room. */}
                      <span
                        title={checkedIn ? "Checked in" : "Not checked in"}
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          checkedIn ? "bg-sage-soft text-sage-ink" : "bg-shell text-plum-soft"
                        }`}
                      >
                        <span aria-hidden className="sm:hidden">
                          {checkedIn ? "✓" : "—"}
                        </span>
                        <span className="sr-only sm:not-sr-only">
                          {checkedIn ? "✓ Checked in" : "Not checked in"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Providers">
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[420px] text-left text-[14px]">
              <thead>
                <tr className="whitespace-nowrap text-[11px] uppercase tracking-wide text-plum-soft">
                  <th className="pb-2 font-semibold">Provider</th>
                  <th className="pb-2 pl-4 text-right font-semibold">Today</th>
                  <th className="pb-2 pl-4 text-right font-semibold">Next 7d</th>
                  <th className="pb-2 pl-3 font-semibold">Booked (14d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {data.providers.map((row) => {
                  const provider = providerById(row.id);
                  return (
                    <tr key={row.id}>
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          {provider && <ProviderAvatar provider={provider} size="xs" />}
                          <span className="font-medium">{shortProviderName(row.id)}</span>
                        </span>
                      </td>
                      <td className="py-2.5 pl-4 text-right tabular-nums">{row.today}</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums">{row.next7}</td>
                      <td className="py-2.5 pl-3">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-wine-soft">
                            <span
                              className="block h-full rounded-full bg-wine"
                              style={{ width: pct(row.fill) }}
                            />
                          </span>
                          <span className="w-9 text-right text-[12px] tabular-nums text-plum-soft">
                            {pct(row.fill)}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* --------------------------------------- mix + recent -- */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel
          title="Upcoming patients"
          action={
            <span className="text-[13px] text-plum-soft">{data.mix[0]?.total ?? 0} visits</span>
          }
        >
          <div className="space-y-4">
            {data.mix.map((item) => (
              <Meter key={item.label} {...item} />
            ))}
          </div>
        </Panel>

        <Panel
          title="Latest bookings"
          action={
            <Link
              href="/admin/bookings"
              className="focus-ring text-[13px] font-semibold text-wine link-underline"
            >
              All bookings
            </Link>
          }
        >
          <ul className="-mx-2 divide-y divide-mist">
            {data.recent.map((booking) => (
              <li key={booking.id}>
                <Link
                  href={`/admin/bookings/${booking.id}`}
                  className="focus-ring flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 transition hover:bg-shell"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      {booking.patient.firstName} {booking.patient.lastName}
                    </span>
                    <span className="block truncate text-[12px] text-plum-soft">
                      {formatShort(booking.date)} · {booking.time} ·{" "}
                      {shortProviderName(booking.providerId)} ·{" "}
                      {booking.via === "staff"
                        ? "by staff"
                        : booking.via === "guest"
                          ? "guest"
                          : "account"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      booking.status === "confirmed"
                        ? "bg-sage-soft text-sage-ink"
                        : "bg-wine-soft text-wine-deep"
                    }`}
                  >
                    {booking.status === "confirmed" ? "Confirmed" : "Cancelled"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
