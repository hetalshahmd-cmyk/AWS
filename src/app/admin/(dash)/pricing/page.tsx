import { requireAdminPage } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import PlansEditor from "@/components/admin/PlansEditor";
import { getPlans, getPriceTitles } from "@/lib/repo";

export const metadata: Metadata = { title: "Pricing — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  await requireAdminPage();
  const [plans, titles] = await Promise.all([getPlans(), getPriceTitles()]);

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Pricing</h1>
      <p className="mt-1 text-plum-soft">
        These cards are what patients see on{" "}
        <Link href="/pricing" className="font-semibold text-wine link-underline">
          /pricing
        </Link>
        . Changes go live immediately.
      </p>
      <PlansEditor initial={plans} initialTitles={titles} />
    </div>
  );
}
