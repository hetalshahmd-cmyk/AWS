import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DoctorPanel from "@/components/admin/DoctorPanel";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import { getCurrentAdmin } from "@/lib/auth";
import { listProviderBookings } from "@/lib/repo";
import { isProviderId, providerById } from "@/lib/scheduling";

export const metadata: Metadata = { title: "My appointments — Provider" };
export const dynamic = "force-dynamic";

export default async function DoctorPage() {
  const staff = await getCurrentAdmin().catch(() => null);
  if (!staff || !isProviderId(staff.providerId)) redirect("/admin/login");
  const provider = providerById(staff.providerId);
  const bookings = await listProviderBookings(staff.providerId);

  return (
    <div>
      <div className="flex items-center gap-4">
        {provider && <ProviderAvatar provider={provider} size="sm" />}
        <div>
          <h1 className="font-display text-[1.9rem] font-semibold leading-tight">My appointments</h1>
          <p className="text-plum-soft">
            {provider?.name ?? staff.name} · {provider?.cred}
          </p>
        </div>
      </div>
      <DoctorPanel providerId={staff.providerId} initial={bookings} />
    </div>
  );
}
