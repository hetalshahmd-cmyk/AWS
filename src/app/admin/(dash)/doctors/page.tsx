import type { Metadata } from "next";
import Link from "next/link";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import { requireAdminPage } from "@/lib/auth";
import { getMasterSchedule, listStaff, loadProviders } from "@/lib/repo";
import { ZOCDOC_STALE_DAYS, zocdocAgeDays } from "@/lib/providers";
import { arizonaTodayIso } from "@/lib/scheduling";

export const metadata: Metadata = { title: "Doctors — Admin" };
export const dynamic = "force-dynamic";

/** Every provider, with whether they show on the site and how they sign in. */
export default async function DoctorsPage() {
  await requireAdminPage();
  const [providers, staff, master] = await Promise.all([loadProviders(true), listStaff(), getMasterSchedule()]);
  const today = arizonaTodayIso();
  const loginOf = (id: string) =>
    staff.find((account) => account.role === "provider" && account.providerId === id)?.email ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.9rem] font-semibold">Doctors</h1>
          <p className="mt-1 max-w-[70ch] text-plum-soft">
            Profiles patients see on the Providers page and when booking, and each doctor&apos;s
            sign-in for their own panel. Changes go live within a minute.
          </p>
        </div>
        <Link
          href="/admin/doctors/new"
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-wine px-5 text-[15px] font-semibold text-white transition hover:bg-wine-deep"
        >
          + Add doctor
        </Link>
      </div>

      <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((provider) => {
          const login = loginOf(provider.id);
          return (
            <li key={provider.id}>
              <Link
                href={`/admin/doctors/${provider.id}`}
                className="focus-ring group flex h-full flex-col rounded-2xl border border-mist bg-white p-5 transition hover:border-wine/40 hover:shadow-[0_12px_28px_-20px_rgba(44,32,38,.45)]"
              >
                <div className="flex items-center gap-4">
                  <ProviderAvatar provider={provider} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-semibold text-plum">{provider.name}</p>
                    <p className="truncate text-[14px] text-plum-soft">{provider.cred}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold">
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      provider.active ? "bg-sage-soft text-sage-ink" : "bg-shell text-plum-soft"
                    }`}
                  >
                    {provider.active ? "On the website" : "Hidden"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      login ? "bg-[#eef3fb] text-[#1f3f73]" : "bg-wine-soft text-wine-deep"
                    }`}
                  >
                    {login ? `Sign-in: ${login}` : "No sign-in yet"}
                  </span>
                  {provider.active && !master.some((row) => row.providerId === provider.id) && (
                    <span className="rounded-full bg-[#fff6e5] px-2.5 py-1 text-[#7a4b00]">
                      Not on the weekly schedule
                    </span>
                  )}
                  {provider.zocdocUrl &&
                    (zocdocAgeDays(provider, today) ?? Infinity) > ZOCDOC_STALE_DAYS && (
                      <span className="rounded-full bg-[#fff6e5] px-2.5 py-1 text-[#7a4b00]">
                        Check Zocdoc rating
                      </span>
                    )}
                </div>
                <p className="mt-auto pt-4 text-[14px] font-semibold text-wine group-hover:underline">
                  Edit profile &amp; sign-in →
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
