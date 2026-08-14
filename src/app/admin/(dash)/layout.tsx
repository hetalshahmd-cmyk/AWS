import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import SignOutButton from "@/components/admin/SignOutButton";
import { getCurrentAdmin } from "@/lib/auth";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Reads the account back from Mongo, so an admin deleted from the database
  // loses access on their next page load even with a valid cookie.
  const admin = await getCurrentAdmin().catch(() => null);
  if (!admin) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-shell">
      <header className="border-b border-mist bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-4 px-5 py-3">
          <Link href="/admin" className="focus-ring inline-flex">
            <Image
              src="/logo2.png"
              alt={site.name}
              width={454}
              height={200}
              className="h-[38px] w-auto"
            />
          </Link>
          <span className="rounded-full bg-wine-soft px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-wine">
            Admin
          </span>

          <div className="ml-auto flex items-center gap-3 text-[14px]">
            <Link href="/" className="focus-ring text-plum-soft transition hover:text-wine">
              View site
            </Link>
            <span className="hidden text-plum-soft sm:inline" title={admin.email}>
              {admin.name}
            </span>
            <SignOutButton />
          </div>
        </div>
        <AdminNav />
      </header>

      <main className="mx-auto max-w-[1180px] px-5 py-8">{children}</main>
    </div>
  );
}
