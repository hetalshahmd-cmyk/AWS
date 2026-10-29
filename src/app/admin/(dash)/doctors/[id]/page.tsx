import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DoctorEditor from "@/components/admin/DoctorEditor";
import { requireAdminPage } from "@/lib/auth";
import { getMasterSchedule, getProviderReasons, listStaff, loadProviders } from "@/lib/repo";
import { ALL_VISIT_REASONS } from "@/lib/practice";
import { arizonaTodayIso } from "@/lib/scheduling";

export const metadata: Metadata = { title: "Doctor — Admin" };
export const dynamic = "force-dynamic";

/** One provider's profile and sign-in — or a blank form at /admin/doctors/new. */
export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [providers, staff, reasons, master] = await Promise.all([
    loadProviders(true),
    listStaff(),
    getProviderReasons(),
    getMasterSchedule(),
  ]);
  const provider = id === "new" ? null : (providers.find((item) => item.id === id) ?? null);
  if (id !== "new" && !provider) notFound();
  const login = provider
    ? (staff.find((account) => account.role === "provider" && account.providerId === provider.id)?.email ?? null)
    : null;

  return (
    <div>
      <Link href="/admin/doctors" className="focus-ring text-[14px] font-semibold text-wine link-underline">
        ← All doctors
      </Link>
      <h1 className="mt-3 font-display text-[1.9rem] font-semibold">
        {provider ? provider.name : "Add a doctor"}
      </h1>
      <p className="mt-1 text-plum-soft">
        {provider
          ? "Everything patients see about this provider, and how they sign in."
          : "Fill in the profile; you can add a photo and a sign-in after saving."}
      </p>
      <DoctorEditor
        initial={provider}
        login={login}
        today={arizonaTodayIso()}
        allReasons={[...ALL_VISIT_REASONS]}
        reasons={provider ? ((reasons as Record<string, string[]>)[provider.id] ?? [...ALL_VISIT_REASONS]) : []}
        scheduleRows={provider ? master.filter((row) => row.providerId === provider.id) : []}
      />
    </div>
  );
}
