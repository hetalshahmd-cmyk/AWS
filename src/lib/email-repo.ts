/**
 * Emails from the front desk to a patient, sent through the practice's mail
 * server and kept in `patient_emails` — who sent what, to whom, when, and
 * whether it went. The address always comes from the booking, never from the
 * browser, so this can't be used to email anyone else.
 */
import { ObjectId } from "mongodb";
import { ensureIndexes, getDb } from "./db";
import { sendMail } from "./mail";
import type { Admin } from "./models";
import { MAX_EMAIL, MAX_SUBJECT, type PatientEmail } from "./patient-email";
import { getBookingById } from "./repo";
import { site } from "./site";

type EmailDoc = Omit<PatientEmail, "id" | "sentAt" | "bookingId"> & {
  _id: ObjectId;
  bookingId: ObjectId | null;
  sentAt: Date;
  sentById: string;
};

export class EmailInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailInputError";
  }
}

async function emails() {
  await ensureIndexes();
  return (await getDb()).collection<EmailDoc>("patient_emails");
}

const serialize = (doc: EmailDoc): PatientEmail => ({
  id: doc._id.toString(),
  bookingId: doc.bookingId?.toString() ?? null,
  to: doc.to,
  patientName: doc.patientName,
  subject: doc.subject,
  message: doc.message,
  template: doc.template,
  sentBy: doc.sentBy,
  sentAt: doc.sentAt.toISOString(),
  status: doc.status,
  error: doc.error,
});

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendPatientEmail(
  input: { bookingId?: unknown; subject?: unknown; message?: unknown; template?: unknown },
  staff: Admin,
): Promise<PatientEmail | null> {
  const bookingId = typeof input.bookingId === "string" ? input.bookingId : "";
  if (!/^[a-f\d]{24}$/i.test(bookingId)) return null;
  const booking = await getBookingById(bookingId).catch(() => null);
  if (!booking) return null;

  // One line, no header tricks.
  const subject = typeof input.subject === "string" ? input.subject.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim() : "";
  if (subject.length < 3) throw new EmailInputError("Write a subject");
  if (subject.length > MAX_SUBJECT) throw new EmailInputError(`The subject is too long (${MAX_SUBJECT} characters max)`);
  const message =
    typeof input.message === "string"
      ? input.message.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim()
      : "";
  if (message.length < 5) throw new EmailInputError("Write the message");
  if (message.length > MAX_EMAIL) throw new EmailInputError(`The message is too long (${MAX_EMAIL} characters max)`);
  const template = typeof input.template === "string" ? input.template.slice(0, 40) : "blank";

  const footer = `${site.name} · ${site.phone}`;
  const doc: EmailDoc = {
    _id: new ObjectId(),
    bookingId: new ObjectId(bookingId),
    to: booking.patient.email,
    patientName: `${booking.patient.firstName} ${booking.patient.lastName}`.trim(),
    subject,
    message,
    template,
    sentBy: staff.name,
    sentById: staff.id,
    sentAt: new Date(),
    status: "sent",
    error: null,
  };
  try {
    await sendMail({
      to: booking.patient.email,
      subject,
      text: `${message}\n\n—\n${footer}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#241c20">${escapeHtml(message).replace(/\n/g, "<br>")}</div><p style="margin-top:20px;font-size:13px;color:#5e5357">${escapeHtml(footer)}</p>`,
    });
  } catch (error) {
    console.error("patient email failed", error);
    doc.status = "failed";
    doc.error = "The mail server didn't accept it";
  }
  await (await emails()).insertOne(doc);
  return serialize(doc);
}

export async function listPatientEmails(bookingId: string | null, limit = 100): Promise<PatientEmail[]> {
  const filter = bookingId && /^[a-f\d]{24}$/i.test(bookingId) ? { bookingId: new ObjectId(bookingId) } : {};
  const docs = await (await emails()).find(filter).sort({ sentAt: -1 }).limit(limit).toArray();
  return docs.map(serialize);
}
