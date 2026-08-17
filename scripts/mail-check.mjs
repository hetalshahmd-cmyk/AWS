/**
 * Finds a working SMTP host for the mailbox in .env.local, and optionally sends
 * a test message.
 *
 *   npm run mail:check
 *   npm run mail:check -- --to you@example.com
 *
 * Set SMTP_HOST to pin a host; leave it out to probe the usual GoDaddy and
 * domain hosts. Reads env through Next's loader so values match the app exactly.
 */
import "./load-env.mjs";
import nodemailer from "nodemailer";

const user = process.env.SMTP_USER ?? "";
const pass = process.env.SMTP_PASS ?? "";
const from = process.env.SMTP_FROM || user;

const toIndex = process.argv.indexOf("--to");
const to = toIndex !== -1 ? process.argv[toIndex + 1] : "";

if (!user || !pass) {
  console.error("SMTP_USER and SMTP_PASS must be set in .env.local.");
  process.exit(1);
}

function candidates() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure = (process.env.SMTP_SECURE ?? (port === 465 ? "true" : "false")) === "true";

  if (host) {
    const alternate =
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

console.log(`Mailbox: ${user}`);
console.log(`Password length: ${pass.length} characters (as the app reads it)\n`);

let working = null;

for (const candidate of candidates()) {
  const label = `${candidate.host}:${candidate.port} (${candidate.secure ? "SSL" : "STARTTLS"})`;
  process.stdout.write(`Trying ${label}… `);

  const transporter = nodemailer.createTransport({
    ...candidate,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
  });

  try {
    await transporter.verify();
    console.log("OK");
    working = { candidate, transporter };
    break;
  } catch (error) {
    console.log(`failed — ${error.message}`);
    transporter.close();
  }
}

if (!working) {
  console.error(
    "\n✗ No host worked. Check in GoDaddy which product the mailbox belongs to:\n" +
      "  · Workspace / Professional Email  → smtpout.secureserver.net, 465 SSL or 587 STARTTLS\n" +
      "  · Microsoft 365                   → smtp.office365.com, 587 STARTTLS (SMTP AUTH must be\n" +
      "    enabled for the mailbox, and an app password is needed when MFA is on)\n" +
      "Then set SMTP_HOST / SMTP_PORT / SMTP_SECURE in .env.local.",
  );
  process.exit(1);
}

console.log(
  `\n✓ Connected and logged in via ${working.candidate.host}:${working.candidate.port}.\n` +
    "  Pin it in .env.local:\n" +
    `    SMTP_HOST=${working.candidate.host}\n` +
    `    SMTP_PORT=${working.candidate.port}\n` +
    `    SMTP_SECURE=${working.candidate.secure}`,
);

if (to) {
  try {
    const info = await working.transporter.sendMail({
      from,
      to,
      subject: "Arizona Women Specialists — SMTP test",
      text: "If you're reading this, outgoing mail works.",
    });
    console.log(`\n✓ Test message sent to ${to} (${info.messageId}).`);
  } catch (error) {
    console.error(`\n✗ Connected but could not send: ${error.message}`);
    process.exitCode = 1;
  }
} else {
  console.log("\nAdd --to you@example.com to send a real test message.");
}

working.transporter.close();
