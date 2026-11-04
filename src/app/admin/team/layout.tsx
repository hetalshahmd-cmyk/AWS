import { redirect } from "next/navigation";
import { PanelProvider } from "@/components/admin/panel-context";
import StaffShell, { Initials, type StaffLink } from "@/components/admin/StaffShell";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LINKS: StaffLink[] = [
  { href: "/admin/team/bookings", label: "Bookings", icon: "cal" },
  { href: "/admin/team/slots", label: "Appointment slots", icon: "clock" },
  { href: "/admin/team/messages", label: "Patient chats", icon: "mail" },
  { href: "/admin/team/emails", label: "Email", icon: "mail" },
  { href: "/admin/team/site", label: "Website", icon: "edit" },
];

/**
 * The front-desk panel: bookings, appointment slots, patient chats (read
 * only), emails to patients and the website. No doctors, accounts, pricing
 * or settings. Admins can open it too.
 */
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentAdmin().catch(() => null);
  if (!staff) redirect("/login");
  if (staff.role === "provider") redirect("/admin/doctor");

  return (
    <StaffShell links={LINKS} home="/admin/team/bookings" badge="Front desk" name={staff.name} detail={staff.email} avatar={<Initials name={staff.name} />}>
      <PanelProvider base="/admin/team" role={staff.role === "admin" ? "admin" : "staff"}>
        {children}
      </PanelProvider>
    </StaffShell>
  );
}
