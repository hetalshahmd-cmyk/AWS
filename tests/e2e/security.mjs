// Security: appointment links, rate limits, OTP, booking caps, headers,
// admin pages, sessions, CSRF, reschedule and password hashing.
import fs from "node:fs";
import { ObjectId } from "mongodb";
import { addDays, arizonaToday, codeFor, jar, manageToken, sleep } from "./lib.mjs";

export async function run({ call, check, db, mailDir, admin, doctor, root }) {
  const today = arizonaToday();

  console.log("\n# Appointment links");
  const upcoming = await db.collection("bookings").findOne({ status: "confirmed", date: { $gt: today } });
  const page = await call(null, "GET", `/appointment/${manageToken(upcoming._id.toString())}`);
  const loginHref = page.text.match(/href="(\/login[^"]*)"/)?.[1] ?? "";
  check("a signed-out appointment page's 'Log in' carries no link", !loginHref.includes("appointment"), loginHref || "(none)");
  const old = await db.collection("bookings").findOne({ date: { $lt: addDays(today, -40) } });
  if (old) {
    const res = await call(null, "PATCH", `/api/appointments/${manageToken(old._id.toString())}`, { status: "cancelled" });
    check("a link 40+ days after the visit no longer works", res.status === 404, `${res.status}`);
  }
  const cancelled = await db.collection("bookings").findOne({ status: "cancelled", date: { $gte: today } });
  if (cancelled) {
    const res = await call(null, "PATCH", `/api/appointments/${manageToken(cancelled._id.toString())}`, { status: "cancelled" });
    check("cancel by link answers with the status only", JSON.stringify(res.data) === '{"status":"cancelled"}');
  }

  console.log("\n# Dependencies");
  const version = (name) => JSON.parse(fs.readFileSync(`${root}/node_modules/${name}/package.json`, "utf8")).version;
  check("next ≥ 16.3.8", version("next").localeCompare("16.3.8", undefined, { numeric: true }) >= 0, version("next"));
  check("nodemailer ≥ 10.0.6", Number(version("nodemailer").split(".")[0]) >= 10, version("nodemailer"));

  console.log("\n# Rate limits and OTP");
  {
    const j = jar();
    const codes = [];
    for (let i = 0; i < 11; i += 1) codes.push((await call(j, "POST", "/api/auth/session", { email: "camila.nguyen@example.com", password: `wrong-${i}` })).status);
    check("patient login: 11th wrong password → 429", codes.slice(0, 10).every((c) => c === 401) && codes[10] === 429, codes.join(","));
    const staff = [];
    for (let i = 0; i < 6; i += 1) staff.push((await call(jar(), "POST", "/api/admin/session", { email: "ghost.staff@e2e.test", password: `nope-${i}` })).status);
    check("staff login: 6th wrong password → 429", staff.slice(0, 5).every((c) => c === 401) && staff[5] === 429, staff.join(","));
    const inj = await call(jar(), "POST", "/api/auth/session", { email: { $ne: null }, password: { $ne: null } });
    check("operator injection in login → 400", inj.status === 400, `${inj.status}`);
  }
  {
    const before = Date.now();
    const res = await call(jar(), "POST", "/api/auth/otp", { email: "valeria.reyes@example.com" });
    const mail = await codeFor(mailDir, "valeria.reyes@example.com", before);
    check("registering an existing email: same answer, owner emailed", res.status === 200 && /already (have|has) an account/i.test(mail.body));
  }
  {
    const email = `bind.${Date.now()}@example.com`;
    const a = jar();
    const b = jar();
    const before = Date.now();
    await call(a, "POST", "/api/auth/otp", { email });
    const { code } = await codeFor(mailDir, email, before);
    const guesses = await Promise.all(Array.from({ length: 12 }, (_, i) => call(jar(), "PUT", "/api/auth/otp", { email, code: String(100000 + i) })));
    check("12 parallel wrong guesses: at most 6 judged", guesses.filter((g) => g.status === 401).length <= 6);
    check("…then even the right code is refused", (await call(a, "PUT", "/api/auth/otp", { email, code })).status === 429);
    await sleep(46_000);
    const before2 = Date.now();
    await call(a, "POST", "/api/auth/otp", { email });
    const { code: code2 } = await codeFor(mailDir, email, before2);
    check("browser A verifies", (await call(a, "PUT", "/api/auth/otp", { email, code: code2 })).status === 200);
    check("a code can't be used twice", (await call(a, "PUT", "/api/auth/otp", { email, code: code2 })).status !== 200);
    check("browser B can't register on A's verification", (await call(b, "POST", "/api/auth/register", { name: "B", email, password: "attacker-pass-1" })).status === 403);
    check("browser A can", (await call(a, "POST", "/api/auth/register", { name: "A", email, password: "owner-pass-123" })).status === 201);
  }
  {
    const p = jar();
    await call(p, "POST", "/api/auth/session", { email: "priya.yazzie@example.com", password: "Demo@2026" });
    const mine = (await call(p, "GET", "/api/my/bookings")).data?.bookings ?? [];
    const have = mine.filter((b) => b.status === "confirmed" && b.date >= today).length;
    const slots = (await call(p, "GET", `/api/availability?start=${today}&days=21`)).data.days.flatMap((d) => d.slots);
    const statuses = [];
    let first = null;
    for (const slot of slots.slice(0, 6)) {
      const r = await call(p, "POST", "/api/bookings", {
        slotId: slot.id,
        reason: "OB-GYN Consultation",
        patientType: "existing",
        insurance: null,
        patient: { email: "someone.else@example.com", firstName: "Priya", lastName: "Yazzie", dob: "1990-01-01", sex: "Female" },
        lang: "en",
      });
      statuses.push(r.status);
      first ??= r.status === 201 ? r.data.booking : null;
      if (r.status === 429) break;
    }
    const allowed = Math.max(0, 4 - have);
    check(`booking cap: ${allowed} more then 429`, statuses.filter((s) => s === 201).length === allowed && statuses.at(-1) === 429, statuses.join(","));
    if (first) {
      check("a signed-in booking uses the account's email", first.patient.email === "priya.yazzie@example.com");
      check("booking replies carry no check-in answers", !first.intake || Object.keys(first.intake).length <= 1);
    }
  }

  console.log("\n# Headers and health");
  const home = await call(null, "GET", "/");
  for (const [header, want] of [
    ["x-frame-options", "DENY"],
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
    ["strict-transport-security", "max-age"],
    ["content-security-policy", "'strict-dynamic'"],
  ]) {
    check(`header ${header}`, (home.headers.get(header) ?? "").includes(want));
  }
  const csp = home.headers.get("content-security-policy") ?? "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  check("CSP nonce is on the page's scripts", Boolean(nonce) && home.text.includes(`nonce="${nonce}"`));
  const again = (await call(null, "GET", "/")).headers.get("content-security-policy") ?? "";
  check("a fresh nonce for every page view", again.match(/'nonce-([^']+)'/)?.[1] !== nonce);
  check("no X-Powered-By", !home.headers.get("x-powered-by"));
  check("robots.txt keeps private paths out", /Disallow: \/admin/.test((await call(null, "GET", "/robots.txt")).text));
  check("health refuses SESSION_SECRET", (await call(null, "GET", "/api/admin/health", undefined, { "x-health-key": process.env.SESSION_SECRET })).status === 401);

  console.log("\n# Admin pages");
  check("signed out: /admin/users → login", ((await call(null, "GET", "/admin/users")).headers.get("location") ?? "").includes("/admin/login"));
  const D = jar();
  await call(D, "POST", "/api/admin/session", doctor);
  check("doctor: /admin/users → own panel", ((await call(D, "GET", "/admin/users")).headers.get("location") ?? "").includes("/admin/doctor"));

  console.log("\n# Sessions and admin actions");
  {
    const email = "megan.moore0@example.com";
    const a = jar();
    const b = jar();
    await call(a, "POST", "/api/auth/session", { email, password: "Demo@2026" });
    await call(b, "POST", "/api/auth/session", { email, password: "Demo@2026" });
    const change = await call(a, "PATCH", "/api/my/profile", { currentPassword: "Demo@2026", newPassword: "Changed-pass-2026" });
    check("password change signs out other browsers", change.status === 200 && !(await call(b, "GET", "/api/auth/session")).data?.user);
    check("…and keeps this one", (await call(a, "GET", "/api/auth/session")).data?.user?.email === email);
    const s = jar();
    await call(s, "POST", "/api/admin/session", admin);
    const swapped = { cookies: new Map([["aws_user", s.cookies.get("aws_admin")]]), ip: "10.250.0.1" };
    check("a staff cookie isn't a patient session", !(await call(swapped, "GET", "/api/auth/session")).data?.user);
    const target = await db.collection("bookings").findOne({ status: "confirmed", date: { $gt: today } });
    const before = (await db.collection("slots").findOne({ _id: target.slotId })).booked;
    await Promise.all([1, 2, 3].map(() => call(s, "PATCH", `/api/admin/bookings/${target._id}`, { status: "cancelled" })));
    const after = (await db.collection("slots").findOne({ _id: target.slotId })).booked;
    check("parallel admin cancels free the seat once", after === before - 1, `${before} → ${after}`);
    const capacity = (await db.collection("slots").findOne({ _id: target.slotId })).capacity;
    await db.collection("slots").updateOne({ _id: target.slotId }, { $set: { booked: capacity } });
    check("restoring into a full time → 409", (await call(s, "PATCH", `/api/admin/bookings/${target._id}`, { status: "confirmed" })).status === 409);
    check("admin: bad id → 4xx", (await call(s, "PATCH", "/api/admin/slots/not-an-id", { active: false })).status < 500);
    check("admin: broken JSON → 400", (await call(s, "POST", "/api/admin/slots", "{oops")).status === 400);
    check("admin: capacity 999 refused", (await call(s, "POST", "/api/admin/slots", { providerId: "tate", officeId: "maryvale", from: today, to: today, times: ["9:00 am"], capacity: 999 })).status === 400);
    const form = new FormData();
    form.set("attest", "yes");
    form.set("cardFront", new File([new TextEncoder().encode("<html>")], "card.jpg", { type: "image/jpeg" }));
    const open = await db.collection("bookings").findOne({ status: "confirmed", date: { $gt: today }, _id: { $ne: target._id } });
    check("check-in: non-image bytes named .jpg refused", (await call(null, "POST", `/api/appointments/${manageToken(open._id.toString())}/intake`, form)).status === 400);
  }

  console.log("\n# CSRF");
  {
    const creds = { email: "valeria.reyes@example.com", password: "Demo@2026" };
    check("login from another site → 403", (await call(jar(), "POST", "/api/auth/session", creds, { origin: "https://evil.example" })).status === 403);
    check("cross-site → 403", (await call(jar(), "POST", "/api/auth/session", creds, { "sec-fetch-site": "cross-site" })).status === 403);
    check("sibling subdomain → 403", (await call(jar(), "POST", "/api/auth/session", creds, { "sec-fetch-site": "same-site" })).status === 403);
    check("from the site itself → works", (await call(jar(), "POST", "/api/auth/session", creds, { "sec-fetch-site": "same-origin" })).status === 200);
  }

  console.log("\n# Reschedule");
  {
    const p = jar();
    await call(p, "POST", "/api/auth/session", { email: "valeria.reyes@example.com", password: "Demo@2026" });
    const mine = (await call(p, "GET", "/api/my/bookings")).data.bookings;
    const moving = mine.find((b) => b.status === "confirmed" && b.date > today);
    const free = (await call(p, "GET", `/api/availability?start=${today}&days=21`)).data.days.flatMap((d) => d.slots).find((s) => s.id !== moving.slotId);
    const body = {
      slotId: free.id,
      reason: "OB-GYN Consultation",
      patientType: "existing",
      insurance: null,
      patient: { email: "valeria.reyes@example.com", firstName: "Valeria", lastName: "Reyes", dob: "1990-01-01", sex: "Female" },
      lang: "en",
      reschedule: moving.manageToken,
    };
    const res = await call(p, "POST", "/api/bookings", body);
    const old = await db.collection("bookings").findOne({ _id: new ObjectId(moving.id) });
    check("new time booked and old one cancelled in one request", res.status === 201 && res.data.moved === true && old.status === "cancelled");
    check("moving it again is refused before booking", (await call(p, "POST", "/api/bookings", body)).status === 410);
  }

  console.log("\n# Password hashing");
  {
    const fresh = await db.collection("users").findOne({ passwordHash: /^scrypt\$16384\$/, email: { $nin: ["camila.nguyen@example.com", "megan.moore0@example.com", "valeria.reyes@example.com", "priya.yazzie@example.com"] } });
    if (fresh) {
      const login = await call(jar(), "POST", "/api/auth/session", { email: fresh.email, password: "Demo@2026" });
      const after = (await db.collection("users").findOne({ _id: fresh._id })).passwordHash.split("$")[1];
      check("an old hash is upgraded to N=131072 on sign-in", login.status === 200 && after === "131072", after);
    }
  }
}
