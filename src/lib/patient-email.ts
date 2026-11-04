/**
 * Emails the front desk writes to one patient about their booking (Admin →
 * Email, or "Email patient" on a booking). The browser fills in a template;
 * staff can change every word before sending. Shared by browser and server.
 */

export type EmailTemplate = "time-changed" | "please-call" | "blank";

export type BookingForEmail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  lang: "en" | "es";
  date: string;
  time: string;
  providerName: string;
  officeName: string;
};

export type PatientEmail = {
  id: string;
  bookingId: string | null;
  to: string;
  patientName: string;
  subject: string;
  message: string;
  template: string;
  sentBy: string;
  sentAt: string;
  status: "sent" | "failed";
  error: string | null;
};

export const MAX_SUBJECT = 150;
export const MAX_EMAIL = 5000;

export const TEMPLATE_LABELS: Record<EmailTemplate, string> = {
  "time-changed": "Appointment time changed",
  "please-call": "Please call the office",
  blank: "Blank email",
};

const TZ = "America/Phoenix";

/** "Wednesday, November 12 at 9:30 am" (or Spanish). */
export function spokenWhen(date: string, time: string, lang: "en" | "es"): string {
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return lang === "es" ? `${day} a las ${time}` : `${day} at ${time}`;
}

/** "17:30" from a time field → "5:30 pm", the way the site writes times. */
export function fromTimeField(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "pm" : "am"}`;
}

/** "5:30 pm" → "17:30" for a time field. */
export function toTimeField(time: string): string {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(time.trim());
  if (!match) return "";
  const hours = (Number(match[1]) % 12) + (match[3].toLowerCase() === "pm" ? 12 : 0);
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

export function fillTemplate(
  template: EmailTemplate,
  booking: BookingForEmail,
  practice: { name: string; phone: string },
  moved?: { date: string; time: string },
): { subject: string; message: string } {
  const es = booking.lang === "es";
  const when = spokenWhen(booking.date, booking.time, booking.lang);
  const newWhen = moved ? spokenWhen(moved.date, moved.time, booking.lang) : when;
  const hello = es ? `Hola ${booking.firstName}:` : `Hello ${booking.firstName},`;
  if (template === "time-changed") {
    return es
      ? {
          subject: "Cambió la hora de su cita",
          message: `${hello}\n\nSu cita con ${booking.providerName} en nuestra ${booking.officeName} cambió al ${newWhen}.\n\nSi la nueva hora no le conviene, llámenos al ${practice.phone} y buscamos otra.\n\nHasta pronto,\n${practice.name}`,
        }
      : {
          subject: "Your appointment time has changed",
          message: `${hello}\n\nYour appointment with ${booking.providerName} at our ${booking.officeName} has been moved to ${newWhen}.\n\nIf the new time doesn't work for you, call us at ${practice.phone} and we'll find another one.\n\nSee you soon,\n${practice.name}`,
        };
  }
  if (template === "please-call") {
    return es
      ? {
          subject: "Por favor llame a nuestra oficina",
          message: `${hello}\n\nPor favor llámenos al ${practice.phone} sobre su cita del ${when}. Queremos revisar un detalle con usted antes de su visita.\n\nGracias,\n${practice.name}`,
        }
      : {
          subject: "Please call our office about your appointment",
          message: `${hello}\n\nPlease call us at ${practice.phone} about your appointment on ${when}. We'd like to go over a detail with you before your visit.\n\nThank you,\n${practice.name}`,
        };
  }
  return { subject: "", message: `${hello}\n\n\n\n${practice.name}` };
}
