import type { Booking } from "./models";
import { timeToMinutes } from "./models";
import { practice } from "./practice";
import { officeById, providerById } from "./scheduling";
import { site } from "./site";

/** Office address for a booking, falling back to the main office. */
export function bookingAddress(booking: Pick<Booking, "officeId">): string {
  return officeById(booking.officeId)?.address.join(", ") ?? practice.addressFull;
}

/**
 * Downloads an .ics file the patient can open in Apple/Google/Outlook
 * calendar. Arizona has no daylight saving, so the start is always 7 hours
 * behind UTC. The visit reason is deliberately left out — calendars sync to
 * many devices and are often shared.
 */
export function downloadCalendarFile(
  booking: Pick<Booking, "id" | "date" | "time" | "providerId" | "officeId">,
) {
  const [y, m, d] = booking.date.split("-").map(Number);
  const minutes = timeToMinutes(booking.time);
  const start = new Date(Date.UTC(y, m - 1, d, 7, 0) + minutes * 60_000);
  const end = new Date(start.getTime() + 30 * 60_000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (text: string) => text.replace(/[\\,;]/g, (c) => `\\${c}`);
  const provider = providerById(booking.providerId);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Arizona Women Specialists//Appointments//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@arizonawomenspecialists.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`Appointment — ${site.name}`)}`,
    `LOCATION:${escape(bookingAddress(booking))}`,
    `DESCRIPTION:${escape(
      `${provider ? `With ${provider.name}. ` : ""}Questions or changes: ${site.phone}.`,
    )}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `appointment-${booking.date}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
