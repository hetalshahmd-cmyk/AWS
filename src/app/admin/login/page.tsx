import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { getSession } from "@/lib/auth";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Admin sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-shell px-5 py-12">
      <div className="w-full max-w-sm">
        <Image
          src="/logo2.png"
          alt={site.name}
          width={454}
          height={200}
          priority
          className="mx-auto mb-8 h-13 w-auto"
        />
        <div className="rounded-2xl border border-mist bg-white p-7 shadow-[0_1px_2px_rgba(44,32,38,.05),0_14px_32px_-18px_rgba(92,30,45,.2)]">
          <h1 className="font-display text-[1.6rem] font-semibold">Admin sign in</h1>
          <p className="mt-1 text-[0.95rem] text-plum-soft">
            Manage bookings, appointment slots and pricing.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
