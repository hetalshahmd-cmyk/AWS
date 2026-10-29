import { redirect } from "next/navigation";
import StaffShell, { Initials, type StaffLink } from "@/components/admin/StaffShell";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LINKS: StaffLink[] = [
  { href: "/admin", label: "Dashboard", icon: "pulse", exact: true },
  { href: "/admin/bookings", label: "Bookings", icon: "cal" },
  { href: "/admin/users", label: "Patients", icon: "users" },
  { href: "/admin/slots", label: "Appointment slots", icon: "clock" },
  { href: "/admin/doctors", label: "Doctors", icon: "heart" },
  { href: "/admin/site", label: "Modify site", icon: "edit" },
  { href: "/admin/pricing", label: "Pricing", icon: "tag" },
  { href: "/admin/settings", label: "Settings", icon: "shield" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Reads the account back from Mongo, so an admin deleted from the database
  // loses access on their next page load even with a valid cookie.
  const admin = await getCurrentAdmin().catch(() => null);
  if (!admin) redirect("/admin/login");
  // Doctors sign in on the same page but only get their own panel.
  if (admin.role === "provider") redirect("/admin/doctor");

  return (
    <StaffShell
      links={LINKS}
      home="/admin"
      badge="Admin"
      name={admin.name}
      detail={admin.email}
      avatar={<Initials name={admin.name} />}
    >
      {children}
    </StaffShell>
  );
}
