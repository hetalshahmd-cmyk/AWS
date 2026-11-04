// User accounts, the front-desk (staff) panel, and emails to patients.
import fs from "node:fs";
import path from "node:path";
import { arizonaToday, jar } from "./lib.mjs";

function mailFor(mailDir, to, after) {
  if (!fs.existsSync(mailDir)) return [];
  return fs
    .readdirSync(mailDir)
    .map((file) => path.join(mailDir, file))
    .filter((file) => fs.statSync(file).mtimeMs > after)
    .map((file) => fs.readFileSync(file, "utf8"))
    .filter((body) => body.includes(to));
}

export async function run({ call, check, db, admin, doctor, mailDir }) {
  console.log("\n# User accounts, front desk and email");
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);

  // User accounts
  const accounts = await call(A, "GET", "/api/admin/accounts");
  check(
    "Admin → User accounts lists admins and providers, never a password",
    accounts.status === 200 &&
      accounts.data.accounts.some((a) => a.role === "provider" && a.providerName && a.email === "denton@arizonawomen.com") &&
      !JSON.stringify(accounts.data).toLowerCase().includes("passwordhash"),
  );
  check("the page opens", (await call(A, "GET", "/admin/accounts")).text.includes("User accounts"));
  const made = await call(A, "POST", "/api/admin/accounts", { name: "Front Desk", email: "frontdesk@e2e.test", role: "staff", generate: true });
  check("an admin adds a front-desk account with a made-up password", made.status === 201 && made.data.account.role === "staff" && /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/.test(made.data.password ?? ""), made.data.password);
  check("a password under 6 characters is refused", (await call(A, "POST", "/api/admin/accounts", { name: "X", email: "x@e2e.test", role: "staff", password: "short" })).status === 400);
  const six = await call(A, "POST", "/api/admin/accounts", { name: "Six", email: "six@e2e.test", role: "staff", password: "abc123" });
  check("…6 characters is enough", six.status === 201 && (await call(jar(), "POST", "/api/auth/session", { email: "six@e2e.test", password: "abc123" })).status === 200);
  await call(A, "DELETE", `/api/admin/admins/${six.data?.account?.id}`);

  // Reset a provider's password from there.
  const shah = accounts.data.accounts.find((a) => a.providerId === "shah");
  const reset = await call(A, "PATCH", `/api/admin/admins/${shah.id}`, { generate: true });
  check("an admin resets a doctor's password (made up, shown once)", reset.status === 200 && /^[A-Za-z2-9-]{19}$/.test(reset.data.password ?? ""));
  check("…the old password stops working", (await call(jar(), "POST", "/api/auth/session", { email: "shah@arizonawomen.com", password: doctor.password })).status === 401);
  const shahIn = await call(jar(), "POST", "/api/auth/session", { email: "shah@arizonawomen.com", password: reset.data.password });
  check("…the new one signs Dr. Shah in to the doctor panel", shahIn.status === 200 && shahIn.data.redirect === "/admin/doctor");

  // The front desk signs in.
  const F = jar();
  const signedIn = await call(F, "POST", "/api/auth/session", { email: "frontdesk@e2e.test", password: made.data.password });
  check("the front desk signs in on /login and lands on their panel", signedIn.status === 200 && signedIn.data.redirect === "/admin/team");
  check("…their panel opens", (await call(F, "GET", "/admin/team/bookings")).status === 200);
  const adminHome = await call(F, "GET", "/admin/doctors");
  check("…the admin panel sends them back to theirs", (adminHome.headers.get("location") ?? "").endsWith("/admin/team"));
  const allowed = await Promise.all([
    call(F, "GET", "/api/admin/site"),
    call(F, "GET", "/api/admin/bookings"),
    call(F, "GET", `/api/admin/slots?from=${arizonaToday()}&to=${arizonaToday()}`),
    call(F, "GET", "/api/admin/provider-reasons"),
    call(F, "GET", "/api/doctor/chats"),
    call(F, "GET", "/api/admin/emails"),
  ]);
  check("they can use the website, bookings, slots, chats and email", allowed.every((r) => r.status === 200), allowed.map((r) => r.status).join(","));
  const denied = await Promise.all([
    call(F, "GET", "/api/admin/accounts"),
    call(F, "GET", "/api/admin/admins"),
    call(F, "GET", "/api/admin/doctors"),
    call(F, "GET", "/api/admin/articles"),
    call(F, "PATCH", `/api/admin/admins/${shah.id}`, { generate: true }),
    call(F, "DELETE", "/api/admin/bookings/0123456789abcdef01234567"),
  ]);
  check("…but not accounts, passwords, doctors, articles or deleting bookings", denied.every((r) => r.status === 403), denied.map((r) => r.status).join(","));
  const chats = (await call(F, "GET", "/api/doctor/chats")).data.conversations;
  if (chats.length) {
    const form = new FormData();
    form.set("text", "hello");
    check("…and they read chats but can't write in them", (await call(F, "POST", `/api/doctor/chats/${chats[0].id}/messages`, form)).status === 403);
  }
  const page = (await call(F, "GET", "/admin/team/bookings")).text;
  check("the front desk's bookings list has no Delete buttons", !page.includes('aria-label="Delete booking'));
  check("…the admin's still does", (await call(A, "GET", "/admin/bookings")).text.includes('aria-label="Delete booking'));

  // Email a patient about their booking.
  const booking = await db.collection("bookings").findOne({ status: "confirmed", date: { $gte: arizonaToday() } }, { sort: { date: 1 } });
  const id = booking._id.toString();
  const detail = (await call(F, "GET", `/admin/team/bookings/${id}`)).text;
  check("the booking page has Email patient", detail.includes("Email patient"));
  const D = jar();
  await call(D, "POST", "/api/admin/session", doctor);
  check("…a doctor's own booking page doesn't", !(await call(D, "GET", `/admin/doctor/bookings/${id}`)).text.includes("Email patient"));

  const before = Date.now();
  const subject = "Your appointment time has changed\r\nBcc: someone@evil.example";
  const sent = await call(F, "POST", "/api/admin/emails", {
    bookingId: id,
    template: "time-changed",
    subject,
    message: `Hello ${booking.patient.firstName},\n\nYour appointment has been moved to Friday at 10:00 am.`,
    // An address from the browser is ignored — it always goes to the patient on the booking.
    to: "someone@evil.example",
  });
  check("the front desk emails the patient", sent.status === 201 && sent.data.email.to === booking.patient.email && sent.data.email.status === "sent", sent.text.slice(0, 160));
  check("…the subject stays on one line", sent.data?.email?.subject === "Your appointment time has changed Bcc: someone@evil.example");
  let mail = [];
  for (let i = 0; i < 10 && !mail.length; i += 1) {
    mail = mailFor(mailDir, booking.patient.email, before - 1000);
    if (!mail.length) await new Promise((r) => setTimeout(r, 300));
  }
  check("…it reaches the patient's inbox with the new time", mail.some((body) => body.includes("moved to Friday at 10:00 am")));
  const headers = (body) => body.split(/\r?\n\r?\n/)[0];
  check(
    "…addressed to the patient only — no Cc or Bcc, whatever the form sent",
    mail.length > 0 &&
      mail.every((body) => !/^(bcc|cc):/im.test(headers(body)) && /^to:.*$/im.exec(headers(body))?.[0].includes(booking.patient.email) && !/^to:.*evil/im.test(headers(body))),
  );
  const history = await call(F, "GET", `/api/admin/emails?booking=${id}`);
  check("the email is in the booking's email list, with who sent it", history.data.emails.some((e) => e.id === sent.data.email.id && e.sentBy === "Front Desk"));
  const bad = await Promise.all([
    call(F, "POST", "/api/admin/emails", { bookingId: id, subject: "Hi", message: "" }),
    call(F, "POST", "/api/admin/emails", { bookingId: id, subject: "", message: "Hello there" }),
  ]);
  check("an empty subject or message is refused", bad.every((r) => r.status === 400));
  check("an unknown booking is refused", (await call(F, "POST", "/api/admin/emails", { bookingId: "0123456789abcdef01234567", subject: "Hello", message: "Hello there" })).status === 404);
  check("doctors can't use it", (await call(D, "POST", "/api/admin/emails", { bookingId: id, subject: "Hello", message: "Hello there" })).status === 403);
  check("the Email page opens for admins and the front desk", (await call(A, "GET", "/admin/emails")).text.includes("Sent emails") && (await call(F, "GET", "/admin/team/emails")).text.includes("Sent emails"));

  // Removing the account signs them out.
  await call(A, "DELETE", `/api/admin/admins/${made.data.account.id}`);
  check("a removed front-desk account is signed out at once", (await call(F, "GET", "/api/admin/bookings")).status === 401);
}
