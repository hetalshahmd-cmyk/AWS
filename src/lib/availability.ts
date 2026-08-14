export type PatientType = "new" | "existing";

export type DaySlots = {
  /** ISO date, e.g. 2026-08-18 */
  iso: string;
  weekday: string;
  monthDay: string;
  isPast: boolean;
  slots: string[];
};

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

const MORNING = ["8:00 am", "8:45 am", "9:30 am", "10:15 am", "11:00 am", "11:45 am"];
const AFTERNOON = ["1:00 pm", "1:45 pm", "2:45 pm", "3:15 pm", "4:00 pm", "4:45 pm"];

/** Stable string hash so server and client always agree — no Math.random(). */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

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

export function formatRange(startIso: string, endIso: string): string {
  const start = fromIso(startIso);
  const end = fromIso(endIso);
  const fmt = (d: Date) =>
    `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

/** "Tue, Aug 18" — the heading style used inside the booking modal. */
export function formatShort(iso: string): string {
  const d = fromIso(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

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

/**
 * Deterministic mock availability. A real build would swap this for the
 * scheduling API — the shape (`DaySlots[]`) is what the UI depends on.
 */
export function buildDay(
  iso: string,
  todayIso: string,
  patientType: PatientType,
  service: string,
): DaySlots {
  const date = fromIso(iso);
  const day = date.getUTCDay();
  const base: DaySlots = {
    iso,
    weekday: WEEKDAYS[day],
    monthDay: `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`,
    isPast: iso < todayIso,
    slots: [],
  };

  // Closed on weekends, and nothing in the past.
  if (day === 0 || day === 6 || base.isPast) return base;

  const seed = hash(`${iso}|${patientType}|${service}`);

  // New patients get fewer openings than established ones.
  const openThreshold = patientType === "new" ? 0.62 : 0.45;
  if (seed < openThreshold) return base;

  const pool = day === 5 ? MORNING : [...MORNING, ...AFTERNOON];
  const count = Math.max(1, Math.round(seed * (patientType === "new" ? 3 : 6)));

  const slots = pool.filter((_, i) => hash(`${iso}|${i}|${patientType}`) > 0.42);
  return { ...base, slots: (slots.length ? slots : [pool[2]]).slice(0, count) };
}

export function buildWindow(
  startIso: string,
  todayIso: string,
  patientType: PatientType,
  service: string,
  length = 14,
): DaySlots[] {
  return Array.from({ length }, (_, i) =>
    buildDay(addDays(startIso, i), todayIso, patientType, service),
  );
}
