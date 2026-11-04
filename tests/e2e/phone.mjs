// Booking form: a required mobile phone, Female only. A test booking end to
// end — the front desk and the doctor see the phone — then it is cancelled.
import { ObjectId } from "mongodb";
import { addDays, arizonaToday, jar, mondayOf } from "./lib.mjs";

export async function run({ call, check, db, admin, doctor }) {
  console.log("\n# Mobile phone on bookings");
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);
  const D = jar();
  await call(D, "POST", "/api/admin/session", doctor);

  // A demo patient with nothing upcoming who still signs in.
  const today = arizonaToday();
  const P = jar();
  let patient = null;
  for (const user of await db.collection("users").find({ demo: true }, { projection: { email: 1 }, sort: { _id: 1 } }).toArray()) {
    if ((await db.collection("bookings").countDocuments({ "patient.email": user.email, status: "confirmed", date: { $gte: today } })) > 0) continue;
    if ((await call(P, "POST", "/api/auth/session", { email: user.email, password: "Demo@2026" })).status === 200) {
      patient = user;
      break;
    }
  }
  check("a demo patient with nothing booked signs in", Boolean(patient));
  if (!patient) return;

  const day = addDays(mondayOf(today), 28);
  await call(A, "POST", "/api/admin/slots", { providerId: "denton", officeId: "arrowhead", dates: [day], times: ["7:10 am", "7:20 am", "7:40 am"] });
  const slots = (await call(null, "GET", `/api/availability?start=${day}&days=1&provider=denton`)).data.days[0].slots;
  const slotAt = (time) => slots.find((slot) => slot.time === time && slot.providerId === "denton")?.id;
  const person = { email: patient.email, firstName: "Phone", lastName: "Tester", dob: "1991-04-04", sex: "Female" };
  const book = (patientFields, time = "7:10 am") =>
    call(P, "POST", "/api/bookings", { slotId: slotAt(time), reason: "OB-GYN Consultation", patientType: "new", insurance: null, patient: { ...person, ...patientFields }, lang: "en" });

  const refused = await Promise.all([
    book({}),
    book({ phone: "12345" }),
    book({ phone: "(023) 555-0199" }),
    book({ phone: "call me" }),
    book({ phone: "623-555-0199", sex: "Male" }),
    book({ phone: "98765 43210", phoneCountry: "US" }),
  ]);
  check("no phone, a short or made-up number, a number from another country under the US, or Male is refused", refused.every((r) => r.status === 400), refused.map((r) => r.status).join(","));

  const booked = await book({ phone: "1 623.555.0199" });
  check("a patient books with a mobile phone number", booked.status === 201, `${booked.status} ${booked.text.slice(0, 160)}`);
  const id = booked.data?.booking?.id;
  const doc = id ? await db.collection("bookings").findOne({ _id: new ObjectId(id) }) : null;
  check("…saved in one tidy format with the booking", doc?.patient?.phone === "(623) 555-0199" && doc.patient.sex === "Female", JSON.stringify(doc?.patient));

  const detail = (await call(A, "GET", `/admin/bookings/${id}`)).text.replace(/<!-- -->/g, "");
  check("the front desk sees it on the booking, as a number to call", detail.includes("Mobile phone") && detail.includes("(623) 555-0199") && detail.includes('href="tel:+16235550199"'));
  check("…and in the bookings list", (await call(A, "GET", "/admin/bookings")).text.replace(/<!-- -->/g, "").includes("(623) 555-0199"));
  const panel = await call(D, "GET", `/api/doctor/bookings?provider=denton`);
  check("the doctor's own list has it too", (panel.data?.bookings ?? []).some((booking) => booking.id === id && booking.patient.phone === "(623) 555-0199"));

  const india = await book({ phone: "98765 43210", phoneCountry: "IN" }, "7:40 am");
  const indiaDoc = india.data?.booking?.id ? await db.collection("bookings").findOne({ _id: new ObjectId(india.data.booking.id) }) : null;
  check("an Indian mobile number, with India picked, is saved with +91", india.status === 201 && indiaDoc?.patient?.phone === "+91 98765 43210", `${india.status} ${indiaDoc?.patient?.phone}`);
  const indiaDetail = (await call(A, "GET", `/admin/bookings/${india.data?.booking?.id}`)).text;
  check("…and the front desk can call it", indiaDetail.includes('href="tel:+919876543210"'));
  if (india.data?.booking?.id) await call(P, "PATCH", `/api/my/bookings/${india.data.booking.id}`, { status: "cancelled" });

  // Staff booking (phone call, front desk) needs a number too.
  const staffBook = (phone) =>
    call(A, "POST", "/api/doctor/bookings", {
      slotId: slotAt("7:20 am"),
      reason: "OB-GYN Consultation",
      patientType: "existing",
      insurance: null,
      patient: { email: "front.desk.test@example.com", firstName: "Desk", lastName: "Booked", dob: "1988-08-08", sex: "Female", phone },
    });
  check("staff can't book without the patient's mobile phone", (await staffBook("")).status === 400);
  const staff = await staffBook("623 555 0177");
  check("…and with it, it is saved the same way", staff.status === 201 && staff.data.booking.patient.phone === "(623) 555-0177");

  // Cancel the test bookings.
  const cancelled = await call(P, "PATCH", `/api/my/bookings/${id}`, { status: "cancelled" });
  check("the test booking is cancelled", cancelled.status === 200 && (await db.collection("bookings").findOne({ _id: new ObjectId(id) }))?.status === "cancelled");
  if (staff.data?.booking?.id) await call(A, "DELETE", `/api/admin/bookings/${staff.data.booking.id}`);
}
