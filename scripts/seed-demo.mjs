/**
 * Fills a LOCAL database with realistic demo data so every screen has
 * something in it: this week's schedule (saved for this week only — later
 * weeks stay empty until the office sets them), 8 past weeks of visits,
 * demo patient accounts, mostly-full bookings (completed, cancelled,
 * upcoming), guest bookings, Spanish bookings, emails/reminders marked as
 * sent, and check-ins.
 *
 *   npm run seed:demo            add demo data (replaces earlier demo data)
 *   npm run seed:demo -- --reset remove demo data only, add nothing
 *
 * Every document it writes carries `demo: true`; only those are ever removed.
 * Real bookings, admins, plans and the test patient's account are left alone.
 * It refuses to run against anything but a database on this computer, and it
 * sends no email.
 *
 * Demo patients sign in with their email and the password Demo@2026.
 */
import "./load-env.mjs";
import { randomBytes, scrypt } from "node:crypto";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB ?? "arizona";
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(uri)) {
  console.error("Refusing to run: MONGODB_URI is not a database on this computer.");
  process.exit(1);
}
const resetOnly = process.argv.includes("--reset");
const PASSWORD = "Demo@2026";

/* --------------------------------------------------------------- random -- */
let state = 20261005;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (list) => list[Math.floor(rand() * list.length)];
const chance = (p) => rand() < p;
const weighted = (pairs) => {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, w] of pairs) if ((r -= w) <= 0) return value;
  return pairs[0][0];
};

/* ----------------------------------------------------------------- time -- */
const DAY = 86_400_000;
const arizonaToday = () => new Date(Date.now() - 7 * 3600_000).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const toMinutes = (time) => {
  const [, h, m, s] = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(time);
  return ((Number(h) % 12) + (s.toLowerCase() === "pm" ? 12 : 0)) * 60 + Number(m);
};
const minutesToTime = (minutes) => {
  const h24 = Math.floor(minutes / 60);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(minutes % 60).padStart(2, "0")} ${h24 >= 12 ? "pm" : "am"}`;
};
/** The appointment's start as a real instant (Arizona is UTC-7 all year). */
const startsAt = (date, time) => new Date(Date.parse(`${date}T07:00:00Z`) + toMinutes(time) * 60_000);

/* ------------------------------------------- the practice's master week -- */
// The schedule the practice sent for this week — DEFAULT_WEEKLY_SCHEDULE in
// src/lib/scheduling.ts. Past weeks reuse it only to give the demo a history.
const JULIE = ["8:00 am", "10:00 am", "1:00 pm", "3:00 pm", "4:15 pm"];
const KYLEE = ["8:00 am", "10:00 am", "1:00 pm", "3:00 pm"];
const SHAH = ["1:00 pm", "2:00 pm", "3:00 pm", "4:00 pm"];
const SCHEDULE = [
  { weekday: 1, officeId: "maryvale", providerId: "denton", times: JULIE },
  { weekday: 1, officeId: "maryvale", providerId: "shah", times: SHAH },
  { weekday: 1, officeId: "arrowhead", providerId: "tate", times: KYLEE },
  { weekday: 2, officeId: "maryvale", providerId: "tate", times: KYLEE },
  { weekday: 2, officeId: "maryvale", providerId: "shah", times: SHAH },
  { weekday: 2, officeId: "arrowhead", providerId: "denton", times: JULIE },
  { weekday: 3, officeId: "maryvale", providerId: "denton", times: ["8:00 am", "10:00 am", "1:00 pm", "4:15 pm"] },
  { weekday: 3, officeId: "arrowhead", providerId: "shah", times: SHAH },
  { weekday: 4, officeId: "maryvale", providerId: "tate", times: KYLEE },
  { weekday: 4, officeId: "arrowhead", providerId: "denton", times: JULIE },
  { weekday: 5, officeId: "maryvale", providerId: "shah", times: ["8:30 am", "10:00 am", "11:00 am", "1:00 pm", "2:00 pm", "3:00 pm"] },
  { weekday: 5, officeId: "arrowhead", providerId: "tate", times: KYLEE },
];

/* -------------------------------------------------------------- people -- */
const FIRST = [
  "María", "Sofía", "Isabella", "Camila", "Valeria", "Lucía", "Gabriela", "Daniela", "Ana", "Mariana",
  "Jessica", "Ashley", "Emily", "Sarah", "Jennifer", "Amanda", "Brittany", "Megan", "Rachel", "Lauren",
  "Priya", "Aisha", "Grace", "Hannah", "Olivia", "Emma", "Chloe", "Natalie", "Vanessa", "Alejandra",
  "Yesenia", "Guadalupe", "Rosa", "Leticia", "Kayla", "Taylor", "Destiny", "Samantha", "Nicole", "Elena",
];
const LAST = [
  "García", "Martínez", "Hernández", "López", "González", "Rodríguez", "Pérez", "Sánchez", "Ramírez", "Torres",
  "Flores", "Rivera", "Gómez", "Díaz", "Morales", "Ortiz", "Castillo", "Romero", "Smith", "Johnson",
  "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Thomas", "Moore", "Jackson",
  "Patel", "Nguyen", "Kim", "Begay", "Yazzie", "Tso", "Chavez", "Vargas", "Reyes", "Mendoza",
];
const ascii = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const SPANISH_FIRST = new Set(FIRST.slice(0, 10).concat(["Alejandra", "Yesenia", "Guadalupe", "Rosa", "Leticia", "Elena"]));

// Visit reasons as named on Zocdoc, weighted by how often each is booked.
const REASONS = [
  ["OB-GYN Consultation", 14], ["OB-GYN Follow Up", 12], ["Prenatal Care", 11], ["Annual Pap Smear / GYN Exam", 12],
  ["Pregnancy Test", 7], ["Ultrasound", 8], ["Birth Control / Contraception", 7], ["New Patient Visit", 5],
  ["Confirmation of Pregnancy", 4], ["Prenatal Care - First Trimester", 4], ["Pregnancy Follow Up", 4],
  ["Gynecology Consultation", 4], ["Vaginal Discharge / Infection", 3], ["Missed Periods", 2], ["OB Consultation", 2],
  ["First Trimester Screening", 2], ["Sexually Transmitted Infection (STI) Testing", 2], ["Breast Pain", 2],
  ["Prenatal Care - Second Trimester", 2], ["Pre-conception Counseling", 1],
];
const SHAH_REASONS = new Set([
  "Birth Control / Contraception",
  "Gynecology Consultation",
  "New Patient Visit",
  "OB-GYN Consultation",
  "Weight Loss Consultation",
  "Abnormal Pap Test",
  "Confirmation of Pregnancy",
  "Female Infertility",
  "Fertility Awareness / Natural Family Planning",
  "First Trimester Screening",
  "Genetic Counseling / Pregnancy Screening",
  "IUD Insertion",
  "IUD Removal",
  "Missed Periods",
  "OB-GYN Follow Up",
  "Pregnancy Test",
  "Prenatal Care - First Trimester",
  "Recurrent Pregnancy Loss",
  "Ultrasound",
  "Ultrasound Scan - Abdominal / Pelvic",
  "Unwanted Pregnancy",
  "Vaginal Discharge / Infection",
  "Weight Loss Follow Up",
  "Weight Management",
]);
// Kylee Tate's Zocdoc list is shorter; her bookings stay within it.
const TATE_REASONS = new Set([
  "Annual Pap Smear / GYN Exam", "Birth Control / Contraception", "OB-GYN Consultation", "OB-GYN Follow Up",
  "Vaginal Discharge / Infection", "Breast Pain", "Confirmation of Pregnancy", "First Trimester Screening",
  "Missed Periods", "Pregnancy Test", "Prenatal Care - First Trimester", "Ultrasound",
]);
const INSURANCE = [
  [{ carrier: "AHCCCS", plan: "Mercy Care" }, 9],
  [{ carrier: "AHCCCS", plan: "Health Choice Arizona" }, 6],
  [{ carrier: "AHCCCS", plan: "Banner University Family Care" }, 6],
  [{ carrier: "Mercy Care", plan: "Mercy Care Complete Care" }, 5],
  [{ carrier: "Blue Cross Blue Shield of Arizona", plan: "Blue Card PPO" }, 6],
  [{ carrier: "Blue Cross Blue Shield of Arizona", plan: "Alliance HMO" }, 3],
  [{ carrier: "UnitedHealthcare", plan: "Choice Plus POS" }, 5],
  [{ carrier: "Aetna", plan: "Choice POS II" }, 5],
  [{ carrier: "Cigna", plan: "Open Access Plus" }, 4],
  [{ carrier: "Humana", plan: "National POS" }, 2],
  [{ carrier: "Medicare", plan: "Medicare Advantage" }, 2],
  [null, 7],
];
const ALLERGIES = ["", "", "", "Penicillin", "Sulfa drugs", "Latex", "Codeine", "Shellfish", "Ninguna", "Amoxicilina"];
const MEDS = ["", "", "Prenatal vitamins", "Levothyroxine 50 mcg", "Metformin 500 mg", "Sertraline 50 mg", "Vitaminas prenatales", "Iron supplement", "Birth control pill"];
const CONDITIONS = ["", "", "", "Hypothyroidism", "PCOS", "Gestational diabetes (past)", "Asthma", "Anemia", "Migraines", "Hipertensión"];
const SURGERIES = ["", "", "", "C-section (2021)", "Appendectomy (2015)", "Cesárea (2019)", "Tonsillectomy", "Laparoscopy (2022)"];
const STREETS = ["W Indian School Rd", "N 51st Ave", "W Camelback Rd", "W Thomas Rd", "W Bell Rd", "W Union Hills Dr", "N 67th Ave", "W Thunderbird Rd", "N 43rd Ave", "W Glendale Ave"];
const CITIES = [["Phoenix", "85031"], ["Phoenix", "85033"], ["Phoenix", "85035"], ["Glendale", "85308"], ["Glendale", "85304"], ["Peoria", "85382"], ["Phoenix", "85037"]];
const phone = () => `${pick(["602", "623", "480"])}-555-0${String(100 + Math.floor(rand() * 899)).padStart(3, "0")}`;
const dob = (minAge, maxAge) => {
  const age = minAge + Math.floor(rand() * (maxAge - minAge));
  return `${2026 - age}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`;
};

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(k))),
  );
  return ["scrypt", 16384, 8, 1, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/* ------------------------------------------------------------------ run -- */
const client = await MongoClient.connect(uri);
const db = client.db(dbName);
const users = db.collection("users");
const slots = db.collection("slots");
const bookings = db.collection("bookings");
console.log(`Connected to ${dbName} (local).`);

// Earlier demo data out first, so running twice never doubles anything.
const removed = {
  weeks: (await db.collection("week_schedules").deleteMany({ demo: true })).deletedCount,
  bookings: (await bookings.deleteMany({ demo: true })).deletedCount,
  slots: (await slots.deleteMany({ demo: true })).deletedCount,
  users: (await users.deleteMany({ demo: true })).deletedCount,
};
console.log(`Removed earlier demo data: ${removed.users} patients, ${removed.slots} slots, ${removed.bookings} bookings.`);
if (resetOnly) {
  await client.close();
  console.log("Reset done.");
  process.exit(0);
}

// The old single "master schedule" is replaced by one schedule per week.
await db.collection("settings").deleteOne({ _id: "weeklySchedule" });

// This week's schedule, saved for this week only (unless the office already
// saved its own).
const today = arizonaToday();
const thisMonday = addDays(today, -((weekday(today) + 6) % 7));
await db.collection("week_schedules").updateOne(
  { _id: thisMonday },
  { $setOnInsert: { rows: SCHEDULE, custom: false, updatedAt: new Date(), demo: true } },
  { upsert: true },
);

// Slots: 8 weeks back to the end of this week. Later weeks are left for the
// office to set in Admin → Weekly schedule.
const from = addDays(thisMonday, -56);
const to = addDays(thisMonday, 6);
const taken = new Set((await slots.find({}, { projection: { date: 1, time: 1, providerId: 1 } }).toArray()).map((s) => `${s.date}|${s.time}|${s.providerId}`));
const slotDocs = [];
for (let date = from; date <= to; date = addDays(date, 1)) {
  for (const row of SCHEDULE.filter((r) => r.weekday === weekday(date))) {
    for (const time of row.times) {
      const minutes = toMinutes(time);
      const key = `${date}|${minutesToTime(minutes)}|${row.providerId}`;
      if (taken.has(key)) continue;
      slotDocs.push({
        providerId: row.providerId, officeId: row.officeId, date, time: minutesToTime(minutes), minutes,
        capacity: 1, booked: 0, active: true, createdAt: new Date(Date.parse(`${from}T12:00:00Z`)), demo: true,
      });
    }
  }
}
if (slotDocs.length) await slots.insertMany(slotDocs);

// Patients: 45 with accounts, plus guests who booked without one.
const passwordHash = await hashPassword(PASSWORD);
const people = [];
const usedEmails = new Set((await users.find({}, { projection: { email: 1 } }).toArray()).map((u) => u.email));
for (let i = 0; people.length < 70; i++) {
  const first = pick(FIRST);
  const last = pick(LAST);
  const email = `${ascii(first)}.${ascii(last).replace(/\s/g, "")}${i % 7 === 0 ? i : ""}@example.com`;
  if (usedEmails.has(email)) continue;
  usedEmails.add(email);
  const spanish = SPANISH_FIRST.has(first) && chance(0.55);
  people.push({
    first, last, email, spanish,
    dob: dob(18, 58),
    insurance: weighted(INSURANCE),
    account: people.length < 45,
    pronouns: chance(0.06) ? pick(["she/her", "they/them"]) : "",
  });
}
const userDocs = [];
for (const person of people.filter((p) => p.account)) {
  const created = new Date(Date.now() - (20 + Math.floor(rand() * 70)) * DAY);
  const doc = {
    name: `${person.first} ${person.last}`, email: person.email, passwordHash, createdAt: created,
    lastLoginAt: chance(0.7) ? new Date(Date.now() - Math.floor(rand() * 14) * DAY) : null, demo: true,
  };
  userDocs.push(doc);
}
const insertedUsers = userDocs.length ? await users.insertMany(userDocs) : { insertedIds: {} };
userDocs.forEach((doc, i) => {
  people.find((p) => p.email === doc.email).userId = insertedUsers.insertedIds[i];
});

// The existing test patient gets visits too, so signing in as them shows data.
const testUser = await users.findOne({ email: "testpatient@arizonawomenspecialists.com" });
const testPerson = testUser
  ? { first: "Test", last: "Patient", email: testUser.email, spanish: false, dob: "1992-04-18",
      insurance: { carrier: "Blue Cross Blue Shield of Arizona", plan: "Blue Card PPO" }, account: true, userId: testUser._id }
  : null;

// Bookings: past weeks nearly full; the future fills less the further out it is.
const allSlots = await slots.find({ demo: true }).sort({ date: 1, minutes: 1 }).toArray();
const nowMs = Date.now();
const bookingDocs = [];
const slotBumps = [];
const regular = people.slice(0, 40); // returning patients — several visits each
const intake = (person) => {
  const [city, zip] = pick(CITIES);
  return {
    phone: phone(), street: `${1000 + Math.floor(rand() * 8999)} ${pick(STREETS)}`, city, state: "AZ", zip,
    emergencyName: `${pick(["Carlos", "Luis", "Miguel", "José", "David", "Michael", "James", "Robert", "Juan", "Daniel"])} ${person.last}`,
    emergencyPhone: phone(),
    memberId: person.insurance ? `${person.insurance.carrier.slice(0, 2).toUpperCase()}${100000000 + Math.floor(rand() * 899999999)}` : "",
    groupNumber: person.insurance ? `G${10000 + Math.floor(rand() * 89999)}` : "",
    cardFrontId: null, cardBackId: null, photoIdId: null,
    allergies: pick(ALLERGIES), medications: pick(MEDS), conditions: pick(CONDITIONS), surgeries: pick(SURGERIES),
    lmp: "", pregnant: pick(["", "no", "no", "yes", "not-sure"]), pregnancies: String(Math.floor(rand() * 4)),
  };
};

// The test patient: one visit about three weeks back, one in the next few days.
const testDates = testPerson
  ? [allSlots.find((s) => s.date >= addDays(today, -21))?.date, allSlots.find((s) => s.date >= addDays(today, 2))?.date]
  : [];

// Everyone gets at least one past visit, and as many account holders as the
// open times allow get an upcoming one, so every login has a real history.
const shuffle = (list) =>
  list.map((item) => [rand(), item]).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
const needsPast = shuffle(people);
const needsUpcoming = shuffle(people.filter((person) => person.account));

for (const slot of allSlots) {
  const start = startsAt(slot.date, slot.time).getTime();
  const daysAhead = (start - nowMs) / DAY;
  const fill = daysAhead < 0 ? 0.96 : 0.75;
  if (!chance(fill)) continue;

  const past = daysAhead < 0;
  const cancelled = past ? chance(0.07) : chance(0.05);
  // Only a kept visit counts towards someone's history.
  const queue = past ? needsPast : needsUpcoming;
  let person =
    !cancelled && queue.length && chance(0.6)
      ? queue.shift()
      : chance(0.75)
        ? pick(regular)
        : pick(people);
  if (testPerson && testDates.includes(slot.date) && !bookingDocs.some((b) => b.patient.email === testPerson.email && b.date === slot.date)) {
    person = testPerson;
  }
  const reason = weighted(
    slot.providerId === "tate" ? REASONS.filter(([r]) => TATE_REASONS.has(r))
      : slot.providerId === "shah" ? REASONS.filter(([r]) => SHAH_REASONS.has(r))
      : slot.providerId === "denton" ? REASONS.filter(([r]) => r !== "Breast Pain")
      : REASONS,
  );
  const created = new Date(Math.min(nowMs - 3600_000, start - (1 + Math.floor(rand() * 20)) * DAY));
  const viaGuest = !person.account || chance(0.15);
  const doc = {
    slotId: slot._id, providerId: slot.providerId, officeId: slot.officeId,
    userId: person.account ? person.userId : null,
    date: slot.date, time: slot.time, reason,
    patientType: chance(0.72) ? "existing" : "new",
    insurance: person.insurance,
    patient: {
      email: person.email, firstName: person.first, lastName: person.last, dob: person.dob, sex: "Female",
      ...(person.pronouns ? { pronouns: person.pronouns } : {}),
    },
    status: cancelled ? "cancelled" : "confirmed",
    lang: person.spanish ? "es" : "en",
    via: viaGuest ? "guest" : chance(0.15) ? "staff" : "account",
    confirmationSentAt: created.toISOString(),
    reminders: {
      ...(start - 3 * DAY < nowMs && !cancelled ? { threeDay: new Date(start - 3 * DAY - 7 * 3600_000).toISOString() } : {}),
      ...(start - DAY < nowMs && !cancelled ? { oneDay: new Date(start - DAY - 7 * 3600_000).toISOString() } : {}),
    },
    intake: null,
    createdAt: created,
    demo: true,
  };
  // Check-ins: most past visits, about half of next week's, a few further out.
  if (!cancelled && chance(past ? 0.7 : daysAhead < 7 ? 0.5 : 0.15)) {
    const filed = intake(person);
    if (/Prenatal|Pregnancy|Ultrasound|Trimester/.test(reason)) filed.pregnant = "yes";
    if (filed.pregnant !== "yes") filed.lmp = addDays(slot.date, -(5 + Math.floor(rand() * 25)));
    doc.intake = { ...filed, submittedAt: new Date(Math.min(start - 3600_000, created.getTime() + rand() * (start - created.getTime()))).toISOString() };
  }
  bookingDocs.push(doc);
  if (!cancelled) slotBumps.push(slot._id);
}
// A couple of switched-off times, like a provider out for a morning.
const offSlots = allSlots.filter((s) => (startsAt(s.date, s.time).getTime() - nowMs) / DAY > 10).slice(0, 60).filter(() => chance(0.08));

if (bookingDocs.length) await bookings.insertMany(bookingDocs);
if (slotBumps.length) await slots.updateMany({ _id: { $in: slotBumps } }, { $set: { booked: 1 } });
if (offSlots.length) await slots.updateMany({ _id: { $in: offSlots.map((s) => s._id).filter((id) => !slotBumps.some((b) => b.equals(id))) } }, { $set: { active: false } });

const upcoming = bookingDocs.filter((b) => b.status === "confirmed" && startsAt(b.date, b.time).getTime() > nowMs).length;
const openAhead = await slots.countDocuments({ demo: true, booked: 0, active: true, date: { $gte: today } });
console.log(`Slots: ${slotDocs.length} (${from} → ${to}), ${openAhead} still open from today on.`);
console.log(`Patients: ${userDocs.length} accounts + ${people.length - userDocs.length} guests${testPerson ? " + the existing test patient" : ""}.`);
console.log(`Bookings: ${bookingDocs.length} — ${upcoming} upcoming, ${bookingDocs.filter((b) => b.status === "cancelled").length} cancelled, ${bookingDocs.filter((b) => b.intake).length} checked in, ${bookingDocs.filter((b) => b.lang === "es").length} in Spanish.`);
const visitTime = (b) => startsAt(b.date, b.time).getTime();
const kept = bookingDocs.filter((b) => b.status === "confirmed");
const withPast = new Set(kept.filter((b) => visitTime(b) <= nowMs).map((b) => b.patient.email));
const withUpcoming = new Set(kept.filter((b) => visitTime(b) > nowMs).map((b) => b.patient.email));
console.log(
  `Demo patients with a past visit: ${people.filter((p) => withPast.has(p.email)).length}/${people.length}; with an upcoming one: ${people.filter((p) => withUpcoming.has(p.email)).length}.`,
);
console.log(`\nDemo patients sign in with their email and password ${PASSWORD}, e.g. ${userDocs[0]?.email}.`);
await client.close();
