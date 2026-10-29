import { manageUrl, siteUrl } from "./booking-links";
import { longDate, t, type Lang } from "./i18n";
import { sendMail } from "./mail";
import type { Booking } from "./models";
import { officeById, providerById } from "./scheduling";
import { site } from "./site";

/**
 * Patient emails about an appointment. Deliberately minimal: date, time,
 * provider, office and links — never the visit reason, insurance or anything
 * clinical, because email is not a secure channel and inboxes are shared.
 *
 * Sending never throws: a booking or cancellation must succeed even when the
 * mail server is down. Failures are logged for the office to follow up.
 */

type Kind = "confirm" | "reminder" | "cancel";

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function build(kind: Kind, booking: Booking, lang: Lang, daysAhead = 0) {
  const tr = t(lang);
  const date = longDate(booking.date, lang);
  const time = booking.time.toUpperCase();
  const provider = providerById(booking.providerId);
  const office = officeById(booking.officeId);
  const address = office ? office.address.join(", ") : "4700 N 51st Ave, Ste 5, Phoenix, AZ 85031";
  const manage = manageUrl(booking.id);

  const subject =
    kind === "confirm"
      ? tr.emailConfirmSubject(date)
      : kind === "cancel"
        ? tr.emailCancelSubject(date)
        : tr.emailReminderSubject(daysAhead === 1 ? tr.emailWhenTomorrow : tr.emailWhenInDays(daysAhead));
  const heading =
    kind === "confirm" ? tr.emailConfirmHeading : kind === "cancel" ? tr.emailCancelHeading : tr.emailReminderHeading;

  const rows: [string, string][] = [
    [tr.when, `${date} · ${time} MST`],
    ...(provider ? [[tr.with, provider.name] as [string, string]] : []),
    [tr.where, `${office?.name ?? site.name} — ${address}`],
  ];

  const ctas: [string, string][] =
    kind === "cancel"
      ? [[tr.emailBookAgainCta, siteUrl("/about#providers")]]
      : [
          ...(booking.intake?.submittedAt ? [] : [[tr.emailCheckInCta, `${manage}/check-in`] as [string, string]]),
          [tr.emailManageCta, manage],
        ];

  const text = [
    heading,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    ...(kind === "cancel" ? [] : [tr.emailCantMake, ""]),
    ...ctas.map(([label, url]) => `${label}: ${url}`),
    "",
    tr.emailQuestions(site.phone),
    site.name,
  ].join("\n");

  const html = `<!doctype html>
<html lang="${lang}"><body style="margin:0;background:#f6f1eb;padding:32px 16px;font-family:Segoe UI,system-ui,-apple-system,Arial,sans-serif;color:#241c20">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e9e1d9;border-radius:16px">
    <tr><td style="padding:28px 28px 6px">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#7c2c3e">${escape(site.name)}</p>
      <h1 style="margin:12px 0 0;font-size:22px;line-height:1.25;font-weight:600">${escape(heading)}</h1>
    </td></tr>
    <tr><td style="padding:16px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f4;border-radius:12px">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:10px 14px;font-size:13px;color:#5e5357;white-space:nowrap;vertical-align:top">${escape(label)}</td><td style="padding:10px 14px;font-size:15px;font-weight:600">${escape(value)}</td></tr>`,
          )
          .join("")}
      </table>
      ${kind === "cancel" ? "" : `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#5e5357">${escape(tr.emailCantMake)}</p>`}
    </td></tr>
    <tr><td style="padding:4px 28px 22px">
      ${ctas
        .map(
          ([label, url], index) =>
            `<a href="${escape(url)}" style="display:inline-block;margin:6px 8px 0 0;padding:12px 18px;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;${
              index === 0 ? "background:#7c2c3e;color:#fff" : "border:1px solid #e9e1d9;color:#241c20"
            }">${escape(label)}</a>`,
        )
        .join("")}
    </td></tr>
    <tr><td style="padding:0 28px 26px;border-top:1px solid #e9e1d9">
      <p style="margin:16px 0 0;font-size:13px;color:#5e5357">${escape(tr.emailQuestions(site.phone))}</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

async function deliver(kind: Kind, booking: Booking, lang: Lang, daysAhead = 0): Promise<boolean> {
  try {
    await sendMail({ to: booking.patient.email, ...build(kind, booking, lang, daysAhead) });
    return true;
  } catch (error) {
    console.error(`appointment ${kind} email failed`, booking.id, error);
    return false;
  }
}

export function sendConfirmation(booking: Booking) {
  return deliver("confirm", booking, booking.lang ?? "en");
}

export function sendReminder(booking: Booking, daysAhead: number) {
  return deliver("reminder", booking, booking.lang ?? "en", daysAhead);
}

export function sendCancellation(booking: Booking) {
  return deliver("cancel", booking, booking.lang ?? "en");
}

/** The 6-digit code a guest gets to confirm a booking, in their language. */
export function bookingCodeEmail(code: string, lang: Lang) {
  const tr = t(lang);
  const subject = tr.emailCodeSubject(code, site.name);
  const text = [tr.emailCodeBody, "", code, "", tr.emailCodeExpires, "", `${site.name} · ${site.phone}`].join("\n");
  const html = `<!doctype html>
<html lang="${lang}"><body style="margin:0;background:#f6f1eb;padding:32px 16px;font-family:Segoe UI,system-ui,-apple-system,Arial,sans-serif;color:#241c20">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e9e1d9;border-radius:16px">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#7c2c3e">${escape(site.name)}</p>
      <h1 style="margin:12px 0 0;font-size:22px;line-height:1.25;font-weight:600">${escape(tr.emailCodeHeading)}</h1>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#5e5357">${escape(tr.emailCodeBody)}</p>
    </td></tr>
    <tr><td style="padding:20px 28px">
      <div style="background:#f4e8ea;border-radius:12px;padding:18px;text-align:center">
        <span style="font-size:34px;font-weight:700;letter-spacing:.34em;color:#5c1e2d">${code}</span>
      </div>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#5e5357">${escape(tr.emailCodeExpires)}</p>
    </td></tr>
    <tr><td style="padding:0 28px 26px;border-top:1px solid #e9e1d9">
      <p style="margin:16px 0 0;font-size:13px;color:#5e5357">${escape(site.name)} &middot; ${escape(site.phone)}</p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}
