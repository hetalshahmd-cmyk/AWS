import { requireAdminPage } from "@/lib/auth";
import type { Metadata } from "next";
import ArchiveManager from "@/components/admin/ArchiveManager";
import { listArchive } from "@/lib/repo";

export const metadata: Metadata = { title: "Archive — Admin" };
export const dynamic = "force-dynamic";

/** Deleted bookings and patients, until an admin restores or erases them. */
export default async function ArchivePage() {
  await requireAdminPage();
  const { bookings, patients } = await listArchive();
  return (
    <div>
      <h1 className="font-display text-[2rem] font-semibold leading-tight">Archive</h1>
      <p className="mt-1 max-w-[70ch] text-[15px] text-plum-soft">
        Deleted bookings and patients wait here. Restore them, or tick some and delete them permanently.
        Either way the dashboard numbers stay the same.
      </p>
      <ArchiveManager bookings={bookings} patients={patients} />
    </div>
  );
}
