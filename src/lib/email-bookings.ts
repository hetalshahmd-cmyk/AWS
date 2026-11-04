import type { Booking } from "./models";
import type { BookingForEmail } from "./patient-email";
import { officeById, providerById } from "./scheduling";

export function bookingForEmail(booking: Booking): BookingForEmail {
  return {
    id: booking.id,
    firstName: booking.patient.firstName,
    lastName: booking.patient.lastName,
    email: booking.patient.email,
    lang: booking.lang === "es" ? "es" : "en",
    date: booking.date,
    time: booking.time,
    providerName: providerById(booking.providerId)?.name ?? "your provider",
    officeName: officeById(booking.officeId)?.name ?? "office",
  };
}
