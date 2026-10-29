import { redirect } from "next/navigation";
import PatientSidebar from "@/components/auth/PatientSidebar";
import { LangProvider } from "@/components/lang-context";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

/**
 * The patient's panel: Overview, Appointments and Profile, with their account
 * card and menu beside them. Signed-out visitors go to log in first.
 */
export default async function PatientPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=%2Fmy-bookings");
  const lang = await getLang();

  return (
    <LangProvider initial={lang}>
      <div className="min-h-full bg-ivory">
        <div className="mx-auto grid w-full max-w-7xl items-start gap-5 px-[clamp(16px,4vw,40px)] py-[clamp(1.25rem,3.5vw,2.5rem)] lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10">
          <PatientSidebar name={user.name} email={user.email} memberSince={user.createdAt} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </LangProvider>
  );
}
