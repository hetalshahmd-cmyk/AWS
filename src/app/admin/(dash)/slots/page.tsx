import { requireAdminPage } from "@/lib/auth";
import type { Metadata } from "next";
import ProviderReasonsEditor from "@/components/admin/ProviderReasonsEditor";
import SlotsWorkspace from "@/components/admin/SlotsWorkspace";
import { addDays } from "@/lib/availability";
import { getProviderReasons, getWeekSchedule, listSlotBookings, listSlots } from "@/lib/repo";
import { arizonaTodayIso } from "@/lib/scheduling";

export const metadata: Metadata = { title: "Appointment slots — Admin" };
export const dynamic = "force-dynamic";

export default async function SlotsPage() {
  await requireAdminPage();
  const schedule = await getWeekSchedule(arizonaTodayIso());
  const from = schedule.week;
  const to = addDays(from, 6);
  const [slots, bookedBy, reasons] = await Promise.all([
    listSlots(from, to),
    listSlotBookings(from, to),
    getProviderReasons(),
  ]);

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Appointment slots</h1>
      <p className="mt-1 max-w-[75ch] text-plum-soft">
        Pick a week, set who works when, and save — patients then see exactly those times. Each
        week has its own plan, so next week can be different.
      </p>
      <SlotsWorkspace schedule={schedule} slots={slots} bookedBy={bookedBy} />
      <ProviderReasonsEditor initial={reasons} />
    </div>
  );
}
