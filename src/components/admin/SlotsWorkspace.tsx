"use client";

import { useState } from "react";
import { addDays } from "@/lib/availability";
import type { Slot } from "@/lib/models";
import type { SlotBooking, WeekSchedule } from "@/lib/repo";
import ScheduleEditor from "./ScheduleEditor";
import SlotsManager from "./SlotsManager";

/**
 * One page for one week: the plan (who works where, when) on top, and the
 * real times it produced underneath — open, booked or off. Changing the week
 * or saving the plan updates the list.
 */
export default function SlotsWorkspace({
  schedule,
  slots,
  bookedBy,
}: {
  schedule: WeekSchedule;
  slots: Slot[];
  bookedBy: Record<string, SlotBooking[]>;
}) {
  const [week, setWeek] = useState(schedule.week);
  const [reloadKey, setReloadKey] = useState(0);
  const [planKey, setPlanKey] = useState(0);

  return (
    <>
      <section aria-labelledby="plan-title" className="mt-6">
        <h2 id="plan-title" className="font-display text-[1.35rem] font-semibold">
          1 · Week plan
        </h2>
        <p className="mt-0.5 text-[14px] text-plum-soft">
          Which provider works at which office, and at what times. Save to open these times for
          booking.
        </p>
        <ScheduleEditor
          initial={schedule}
          onWeekChange={setWeek}
          onSaved={() => setReloadKey((value) => value + 1)}
          reloadKey={planKey}
        />
      </section>

      <section aria-labelledby="times-title" className="mt-10">
        <h2 id="times-title" className="font-display text-[1.35rem] font-semibold">
          2 · Times this week
        </h2>
        <p className="mt-0.5 text-[14px] text-plum-soft">
          What patients can book — open, booked (with the patient) or switched off.
        </p>
        <SlotsManager
          initial={slots}
          initialBookedBy={bookedBy}
          from={week}
          to={addDays(week, 6)}
          reloadKey={reloadKey}
          onSlotsChanged={() => setPlanKey((value) => value + 1)}
        />
      </section>
    </>
  );
}
