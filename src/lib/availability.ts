export type PatientType = "new" | "existing";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function toIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: string, days: number): string {
  const date = fromIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** "Tue, Aug 18" */
export function formatShort(iso: string): string {
  const d = fromIso(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Tue, Aug 18 – Mon, Aug 31" */
export function formatRange(startIso: string, endIso: string): string {
  return `${formatShort(startIso)} – ${formatShort(endIso)}`;
}

/** "Tuesday, Aug 18" */
export function formatLong(iso: string): string {
  const d = fromIso(iso);
  const full = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][d.getUTCDay()];
  return `${full}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** What /api/availability returns, one entry per day in the window. */
export type DayAvailability = {
  iso: string;
  weekday: string;
  monthDay: string;
  slots: { id: string; time: string }[];
};
