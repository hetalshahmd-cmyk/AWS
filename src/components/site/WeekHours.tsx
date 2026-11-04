import { dayRange, type Lang } from "@/lib/i18n";
import { summarizeWeek, type OfficeDay } from "@/lib/scheduling";

/**
 * One office's opening hours (Admin → Modify site): neighbouring days with
 * the same hours are joined ("Mon – Fri").
 */
export function weekLines(days: OfficeDay[], lang: Lang = "en") {
  return summarizeWeek(days).map((group) => ({
    days: dayRange(group.from, group.to, lang),
    hours: group.first ? `${group.first} – ${group.last}` : null,
  }));
}

/** Rows for a definition list; `closed` is the word for a day nobody works. */
export default function WeekHours({
  days,
  lang = "en",
  closed = "Closed",
  className = "",
  dtClass = "",
  ddClass = "",
  rowClass = "",
}: {
  days: OfficeDay[];
  lang?: Lang;
  closed?: string;
  className?: string;
  dtClass?: string;
  ddClass?: string;
  rowClass?: string;
}) {
  return (
    <dl className={className}>
      {weekLines(days, lang).map((line) => (
        <div key={line.days} className={rowClass}>
          <dt className={dtClass}>{line.days}</dt>
          <dd className={`${ddClass} ${line.hours ? "" : "opacity-60"}`}>{line.hours ?? closed}</dd>
        </div>
      ))}
    </dl>
  );
}
