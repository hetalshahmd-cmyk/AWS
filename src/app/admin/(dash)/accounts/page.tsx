import type { Metadata } from "next";
import AccountsManager from "@/components/admin/AccountsManager";
import { requireAdminPage } from "@/lib/auth";
import { listStaff, loadProviders } from "@/lib/repo";
import { providerById } from "@/lib/scheduling";

export const metadata: Metadata = { title: "User accounts — Admin" };
export const dynamic = "force-dynamic";

/** Every back-office sign-in in one place, with password resets. */
export default async function AccountsPage() {
  const me = await requireAdminPage();
  await loadProviders();
  const accounts = (await listStaff()).map((account) => ({
    ...account,
    providerName: account.providerId ? (providerById(account.providerId)?.name ?? account.providerId) : null,
  }));

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">User accounts</h1>
      <p className="mt-1 max-w-[78ch] text-plum-soft">
        Everyone who signs in at /login to work on the site: admins, the front desk and providers. Passwords are stored
        scrambled, so nobody — not even an admin — can see one. You can set a new one or have a strong one made up;
        the person is then signed out everywhere and uses the new password.
      </p>
      <AccountsManager meId={me.id} initial={accounts} />
    </div>
  );
}
