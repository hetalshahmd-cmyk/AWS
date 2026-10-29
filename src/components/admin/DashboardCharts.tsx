import { formatShort } from "@/lib/availability";

/*
 * Small, dependency-free charts for the admin dashboard. One hue (wine) for
 * the measured value and its own light tint for the remaining capacity, so no
 * multi-colour palette is involved. Each bar shows its numbers on hover or
 * keyboard focus, and a hidden table carries the same data for screen readers.
 */

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const weekday = (iso: string) => WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const dayNum = (iso: string) => Number(iso.slice(8, 10));

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-plum px-2.5 py-1.5 text-[12px] font-medium text-white shadow-lg group-hover:block group-focus-visible:block"
    >
      {children}
    </span>
  );
}

/** Next 14 days: booked (solid) against all bookable times (tint). */
export function CapacityChart({
  days,
  today,
}: {
  days: { date: string; booked: number; total: number }[];
  today: string;
}) {
  const max = Math.max(1, ...days.map((day) => day.total));
  return (
    <figure>
      <div className="flex items-center gap-4 text-[12px] text-plum-soft">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-wine" /> Booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-wine-soft" /> Still open
        </span>
        <span className="ml-auto tabular-nums">max {max}/day</span>
      </div>
      <div className="mt-3 flex h-44 items-end gap-[3px] border-b border-mist">
        {days.map((day) => (
          <div
            key={day.date}
            tabIndex={0}
            className="group relative flex h-full flex-1 flex-col justify-end outline-none"
            aria-label={`${formatShort(day.date)}: ${day.booked} of ${day.total} booked`}
          >
            <Tip>
              {formatShort(day.date)} · {day.booked} of {day.total} booked
            </Tip>
            {day.total === 0 ? (
              <span className="mx-auto mb-1 text-[11px] text-plum-soft/60">–</span>
            ) : (
              <div
                className="flex flex-col justify-end overflow-hidden rounded-t-[4px] bg-wine-soft transition group-hover:brightness-95"
                style={{ height: `${(day.total / max) * 100}%` }}
              >
                <div
                  className="rounded-t-[4px] bg-wine"
                  style={{ height: `${(day.booked / day.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {days.map((day) => (
          <div
            key={day.date}
            className={`flex-1 text-center text-[11px] leading-tight ${
              day.date === today ? "font-bold text-wine" : "text-plum-soft"
            }`}
          >
            {weekday(day.date)}
            <br />
            {dayNum(day.date)}
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Booked and open times for the next 14 days</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Booked</th>
            <th>Bookable</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>{formatShort(day.date)}</td>
              <td>{day.booked}</td>
              <td>{day.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Visits per week, one series; the latest week is labelled. */
export function WeeksChart({ weeks }: { weeks: { week: string; visits: number }[] }) {
  const max = Math.max(1, ...weeks.map((week) => week.visits));
  const last = weeks.length - 1;
  return (
    <figure>
      <div className="flex h-44 items-end gap-2 border-b border-mist pt-6">
        {weeks.map((week, index) => (
          <div
            key={week.week}
            tabIndex={0}
            className="group relative flex h-full flex-1 flex-col justify-end outline-none"
            aria-label={`Week of ${formatShort(week.week)}: ${week.visits} visits`}
          >
            <Tip>
              Week of {formatShort(week.week)} · {week.visits} visits
            </Tip>
            {index === last && (
              <span className="mb-1 text-center text-[12px] font-semibold tabular-nums text-plum">
                {week.visits}
              </span>
            )}
            <div
              className={`rounded-t-[4px] transition group-hover:brightness-95 ${
                index === last ? "bg-wine" : "bg-wine/55"
              }`}
              style={{ height: `${Math.max(2, (week.visits / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {weeks.map((week, index) => (
          <div
            key={week.week}
            className={`flex-1 text-center text-[11px] ${
              index === last ? "font-bold text-wine" : "text-plum-soft"
            }`}
          >
            {index === last ? "This week" : formatShort(week.week).split(", ")[1]}
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Visits per week, last 8 weeks</caption>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.week}>
              <td>Week of {formatShort(week.week)}</td>
              <td>{week.visits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A labelled share: value, count and a thin same-hue meter. */
export function Meter({ label, part, total }: { label: string; part: number; total: number }) {
  const pct = total ? Math.round((part / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="text-plum">{label}</span>
        <span className="tabular-nums text-plum-soft">
          <span className="font-semibold text-plum">{pct}%</span> · {part}/{total}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-wine-soft"
        role="meter"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-wine" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
