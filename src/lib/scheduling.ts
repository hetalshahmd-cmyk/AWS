import { getAllProviders } from "./providers";
import { getOffices, OFFICE_IDS, type OfficeId } from "./site-content";

/**
 * Who sees patients where, and when. Shared by the server (slot generation,
 * availability) and the browser (booking filters, admin editors), so it must
 * stay free of server-only imports.
 */

/** A provider's id. Providers are added from Admin → Doctors, so any string. */
export type ProviderId = string;
export { OFFICE_IDS, type OfficeId };

/** Every provider's id, hidden ones too (their bookings still exist). */
export function providerIds(): ProviderId[] {
  return getAllProviders().map((provider) => provider.id);
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && getAllProviders().some((provider) => provider.id === value);
}

export function isOfficeId(value: unknown): value is OfficeId {
  return typeof value === "string" && (OFFICE_IDS as string[]).includes(value);
}

/** Finds hidden providers too, so old bookings still show who they were with. */
export function providerById(id: string | null | undefined) {
  return getAllProviders().find((provider) => provider.id === id) ?? null;
}

export function officeById(id: string | null | undefined) {
  // Names and addresses are edited in Admin → Site content.
  return getOffices().find((office) => office.id === id) ?? null;
}

/** "Julie Denton, NP" -> "Julie Denton"; "Dr. Hetalkumar Shah, MD" -> "Dr. Hetalkumar Shah". */
export function shortProviderName(id: string | null | undefined): string {
  return providerById(id)?.name.split(",")[0] ?? "Any provider";
}

/* ------------------------------------------------------------- time -- */

/**
 * Arizona does not observe daylight saving, so the practice is on UTC−7 all
 * year. Using it explicitly keeps "today" right after 5 pm local time, when
 * the UTC date has already rolled over.
 */
const ARIZONA_OFFSET_MINUTES = -7 * 60;

function arizonaNow(): Date {
  return new Date(Date.now() + ARIZONA_OFFSET_MINUTES * 60_000);
}

/** Today's date at the practice, as YYYY-MM-DD. */
export function arizonaTodayIso(): string {
  return arizonaNow().toISOString().slice(0, 10);
}

/** Minutes since midnight at the practice — for hiding times already past today. */
export function arizonaMinutesNow(): number {
  const now = arizonaNow();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

/** Monday of the week containing `iso` (weeks run Monday–Sunday). */
export function mondayOf(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

/* ---------------------------------------------------- weekly template -- */

/** One line of the master schedule: a provider at an office on a weekday. */
export type ScheduleRow = {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  officeId: OfficeId;
  providerId: ProviderId;
  /** Display times, e.g. "8:00 am". */
  times: string[];
};

const JULIE = ["8:00 am", "10:00 am", "1:00 pm", "3:00 pm", "4:15 pm"];
const KYLEE = ["8:00 am", "10:00 am", "1:00 pm", "3:00 pm"];
const SHAH_AFTERNOON = ["1:00 pm", "2:00 pm", "3:00 pm", "4:00 pm"];

/**
 * The schedule the practice sent for the week of Oct 5, 2026. Not applied to
 * any week by itself — Admin → Appointment slots offers it as a starting point
 * when there is no earlier week to copy.
 */
export const DEFAULT_WEEKLY_SCHEDULE: ScheduleRow[] = [
  // Monday
  { weekday: 1, officeId: "maryvale", providerId: "denton", times: JULIE },
  { weekday: 1, officeId: "maryvale", providerId: "shah", times: SHAH_AFTERNOON },
  { weekday: 1, officeId: "arrowhead", providerId: "tate", times: KYLEE },
  // Tuesday
  { weekday: 2, officeId: "maryvale", providerId: "tate", times: KYLEE },
  { weekday: 2, officeId: "maryvale", providerId: "shah", times: SHAH_AFTERNOON },
  { weekday: 2, officeId: "arrowhead", providerId: "denton", times: JULIE },
  // Wednesday
  {
    weekday: 3,
    officeId: "maryvale",
    providerId: "denton",
    times: ["8:00 am", "10:00 am", "1:00 pm", "4:15 pm"],
  },
  { weekday: 3, officeId: "arrowhead", providerId: "shah", times: SHAH_AFTERNOON },
  // Thursday
  { weekday: 4, officeId: "maryvale", providerId: "tate", times: KYLEE },
  { weekday: 4, officeId: "arrowhead", providerId: "denton", times: JULIE },
  // Friday
  {
    weekday: 5,
    officeId: "maryvale",
    providerId: "shah",
    times: ["8:30 am", "10:00 am", "11:00 am", "1:00 pm", "2:00 pm", "3:00 pm"],
  },
  { weekday: 5, officeId: "arrowhead", providerId: "tate", times: KYLEE },
];

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIME = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i;

/** "8:30 AM" or "8:30am" -> "8:30 am". 12-hour times with am/pm only; anything else is null. */
export function normaliseTime(raw: string): string | null {
  const match = TIME.exec(raw.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 1 || hours > 12 || minutes > 59) return null;
  return `${hours}:${match[2]} ${match[3].toLowerCase()}`;
}

/** Validates rows coming from the admin editor; drops anything malformed. */
export function cleanSchedule(input: unknown): ScheduleRow[] {
  if (!Array.isArray(input)) return [];
  const rows: ScheduleRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const weekday = Number(row.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
    if (!isOfficeId(row.officeId) || !isProviderId(row.providerId)) continue;
    const times = Array.isArray(row.times)
      ? [...new Set(row.times.map((time) => normaliseTime(String(time))).filter(Boolean))]
      : [];
    if (times.length === 0) continue;
    rows.push({ weekday, officeId: row.officeId, providerId: row.providerId, times: times as string[] });
  }
  return rows;
}

/* ---------------------------------------------- hours from the week plan -- */

/**
 * Opening times shown anywhere on the site come from the week plan, never
 * from fixed text: for each office and day, the first and last appointment
 * time. A day with nobody scheduled is closed.
 */
export type OfficeDay = { weekday: number; first: string | null; last: string | null };
export type OfficeHours = Record<OfficeId, OfficeDay[]>;

/** Monday first, the way the practice reads a week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function minutes(time: string): number {
  const match = TIME.exec(time.trim());
  if (!match) return 0;
  return ((Number(match[1]) % 12) + (match[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + Number(match[2]);
}

export function hoursFromSchedule(rows: ScheduleRow[]): OfficeHours {
  const hours = {} as OfficeHours;
  for (const officeId of OFFICE_IDS) {
    hours[officeId] = WEEK_ORDER.map((weekday) => {
      const times = rows
        .filter((row) => row.officeId === officeId && row.weekday === weekday)
        .flatMap((row) => row.times)
        .sort((a, b) => minutes(a) - minutes(b));
      return { weekday, first: times[0] ?? null, last: times.at(-1) ?? null };
    });
  }
  return hours;
}

/** True when nobody is scheduled at any office this week. */
export function hoursEmpty(hours: OfficeHours | null): boolean {
  return !hours || OFFICE_IDS.every((id) => hours[id].every((day) => !day.first));
}

/** Neighbouring days with the same times, joined: Mon – Thu 8:00 am – 4:15 pm. */
export function summarizeWeek(
  days: OfficeDay[],
): { from: number; to: number; first: string | null; last: string | null }[] {
  const groups: { from: number; to: number; first: string | null; last: string | null }[] = [];
  for (const day of days) {
    const previous = groups.at(-1);
    if (previous && previous.first === day.first && previous.last === day.last) {
      previous.to = day.weekday;
    } else {
      groups.push({ from: day.weekday, to: day.weekday, first: day.first, last: day.last });
    }
  }
  return groups;
}
