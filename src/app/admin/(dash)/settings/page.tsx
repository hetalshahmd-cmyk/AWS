import type { Metadata } from "next";
import SettingsPanel from "@/components/admin/SettingsPanel";
import { requireAdminPage } from "@/lib/auth";
import { listStaff } from "@/lib/repo";

export const metadata: Metadata = { title: "Settings — Admin" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireAdminPage();
  const admins = (await listStaff()).filter((account) => account.role === "admin");

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Settings</h1>
      <p className="mt-1 text-plum-soft">Your sign-in, and who else can use this panel.</p>
      <SettingsPanel me={me} initialAdmins={admins} />
    </div>
  );
}
