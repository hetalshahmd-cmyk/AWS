import nodemailer, { type Transporter } from "nodemailer";
import { site } from "./site";

export type SmtpCandidate = { host: string; port: number; secure: boolean };

const user = process.env.SMTP_USER ?? "";
const pass = process.env.SMTP_PASS ?? "";
const from = process.env.SMTP_FROM || (user ? `${site.name} <${user}>` : "");

export const mailConfigured = Boolean(user && pass);

/**
 * Hosts to try, best guess first. GoDaddy mailboxes are either legacy Workspace
 * (smtpout.secureserver.net) or Microsoft 365 (smtp.office365.com), and which
 * one an address uses isn't visible from the address itself — so try both
 * rather than making the operator guess. An explicit SMTP_HOST wins outright.
 */
export function smtpCandidates(): SmtpCandidate[] {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = (process.env.SMTP_SECURE ?? (port === 465 ? "true" : "false")) === "true";

  if (host) {
    // Same host, other common port, in case the port is the thing that's wrong.
    const alternate: SmtpCandidate =
      port === 465 ? { host, port: 587, secure: false } : { host, port: 465, secure: true };
    return [{ host, port, secure }, alternate];
  }

  const domain = user.split("@")[1] ?? "";
  return [
    { host: "smtpout.secureserver.net", port: 465, secure: true },
    { host: "smtpout.secureserver.net", port: 587, secure: false },
    { host: "smtp.office365.com", port: 587, secure: false },
    ...(domain
      ? [
          { host: `mail.${domain}`, port: 465, secure: true },
          { host: `smtp.${domain}`, port: 587, secure: false },
        ]
      : []),
  ];
}

function build(candidate: SmtpCandidate): Transporter {
  return nodemailer.createTransport({
    ...candidate,
    auth: { user, pass },
    pool: true,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });
}

// Next hot-reloads modules in dev; keep the working transport across reloads.
const globalForMail = globalThis as unknown as {
  _mailer?: { transport: Transporter; candidate: SmtpCandidate };
};

/** Returns the first candidate that connects and authenticates, then caches it. */
async function resolveTransport(): Promise<{ transport: Transporter; candidate: SmtpCandidate }> {
  if (globalForMail._mailer) return globalForMail._mailer;
  if (!mailConfigured) throw new Error("SMTP_USER and SMTP_PASS are not set");

  const candidates = smtpCandidates();
  const failures: string[] = [];

  for (const candidate of candidates) {
    const transport = build(candidate);
    try {
      await transport.verify();
      console.log(`SMTP ready via ${candidate.host}:${candidate.port}`);
      globalForMail._mailer = { transport, candidate };
      return globalForMail._mailer;
    } catch (error) {
      transport.close();
      failures.push(
        `${candidate.host}:${candidate.port} — ${
          error instanceof Error ? error.message : "failed"
        }`,
      );
    }
  }

  throw new Error(`No SMTP host worked.\n  ${failures.join("\n  ")}`);
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const { transport } = await resolveTransport();
  try {
    await transport.sendMail({ from, ...options });
  } catch (error) {
    // A cached transport can go stale; drop it so the next send re-probes.
    globalForMail._mailer = undefined;
    throw error;
  }
}

export async function verifyMail(): Promise<SmtpCandidate> {
  const { candidate } = await resolveTransport();
  return candidate;
}

export function otpEmail(code: string): { subject: string; text: string; html: string } {
  const subject = `${code} is your ${site.name} verification code`;
  const text = [
    `Your verification code is ${code}.`,
    "",
    "It expires in 10 minutes. If you didn't ask to create an account, you can ignore this email.",
    "",
    `${site.name} · ${site.phone}`,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f7f4f5;padding:32px 16px;font-family:Segoe UI,system-ui,-apple-system,Arial,sans-serif;color:#2c2026">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #ece4e7;border-radius:16px">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#7c2c3e">${site.name}</p>
      <h1 style="margin:12px 0 0;font-size:22px;line-height:1.25;font-weight:600">Confirm your email</h1>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#6c5e63">
        Enter this code to finish creating your account.
      </p>
    </td></tr>
    <tr><td style="padding:20px 28px">
      <div style="background:#f6e7eb;border-radius:12px;padding:18px;text-align:center">
        <span style="font-size:34px;font-weight:700;letter-spacing:.34em;color:#5c1e2d">${code}</span>
      </div>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#6c5e63">
        The code expires in 10 minutes. If you didn&rsquo;t ask to create an account, you can ignore
        this email.
      </p>
    </td></tr>
    <tr><td style="padding:0 28px 26px;border-top:1px solid #ece4e7">
      <p style="margin:16px 0 0;font-size:13px;color:#6c5e63">
        ${site.name} &middot; ${site.phone}<br>4700 N 51st Ave, Ste 5, Phoenix, AZ 85031
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
