import type { Metadata } from "next";
import SlotsManager from "@/components/admin/SlotsManager";
import { listSlots } from "@/lib/repo";
import { addDays, toIso } from "@/lib/availability";

export const metadata: Metadata = { title: "Appointment slots — Admin" };
export const dynamic = "force-dynamic";

export default async function SlotsPage() {
  const from = toIso(new Date());
  const to = addDays(from, 27);
  const slots = await listSlots(from, to);

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold">Appointment slots</h1>
      <p className="mt-1 text-plum-soft">
        Patients can only book times that exist here. Add a batch across a date range, then switch
        individual times off if something comes up.
      </p>
      <SlotsManager initial={slots} from={from} to={to} />
    </div>
  );
}
