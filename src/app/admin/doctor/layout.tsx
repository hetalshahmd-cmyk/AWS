import { redirect } from "next/navigation";
import StaffShell, { Initials, type StaffLink } from "@/components/admin/StaffShell";
import ProviderAvatar from "@/components/site/ProviderAvatar";
import { getCurrentAdmin } from "@/lib/auth";
import { providerById } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

const LINKS: StaffLink[] = [{ href: "/admin/doctor", label: "My appointments", icon: "cal" }];

/**
 * A provider's own panel. Same sign-in as the admin; only provider accounts
 * land here, and they can't open the rest of the admin.
 */
export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentAdmin().catch(() => null);
  if (!staff) redirect("/admin/login");
  if (staff.role !== "provider") redirect("/admin");
  const provider = providerById(staff.providerId);

  return (
    <StaffShell
      links={LINKS}
      home="/admin/doctor"
      badge="Provider"
      name={provider?.name ?? staff.name}
      detail={staff.email}
      avatar={
        provider ? <ProviderAvatar provider={provider} size="xs" /> : <Initials name={staff.name} />
      }
    >
      {children}
    </StaffShell>
  );
}
