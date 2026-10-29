import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PatientProfile from "@/components/auth/PatientProfile";
import { getCurrentUser } from "@/lib/auth";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Profile — ${site.name}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=%2Fmy-bookings%2Fprofile");
  return <PatientProfile name={user.name} email={user.email} />;
}
