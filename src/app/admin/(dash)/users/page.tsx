import type { Metadata } from "next";
import UsersTable from "@/components/admin/UsersTable";
import { listUserRows } from "@/lib/repo";

export const metadata: Metadata = { title: "Patients — Admin" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await listUserRows();

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Patients</h1>
      <p className="mt-1 text-plum-soft">
        Everyone who registered an account on the site. Open a patient to see their appointments.
      </p>
      <UsersTable initial={users} />
    </div>
  );
}
