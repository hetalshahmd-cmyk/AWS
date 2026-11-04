// Booking with insurance that isn't in our list: the patient types it in, the
// booking goes through, and staff see it flagged for a coverage check.
import { ObjectId } from "mongodb";
import { addDays, arizonaToday, jar, mondayOf } from "./lib.mjs";

export async function run({ call, check, db, admin }) {
  console.log("\n# Insurance not in the list");
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);

  // A demo patient with nothing upcoming, so the 3-visit limit doesn't get in the way.
  const today = arizonaToday();
  // (Earlier suites change some demo passwords, so take one that still signs in.)
  let patient = null;
  const P = jar();
  for (const user of await db.collection("users").find({ demo: true }, { projection: { email: 1 }, sort: { _id: -1 } }).toArray()) {
    if ((await db.collection("bookings").countDocuments({ "patient.email": user.email, status: "confirmed", date: { $gte: today } })) > 0) continue;
    if ((await call(P, "POST", "/api/auth/session", { email: user.email, password: "Demo@2026" })).status === 200) {
      patient = user;
      break;
    }
  }
  check("a demo patient with nothing booked signs in", Boolean(patient));
  if (!patient) return;

  const day = addDays(mondayOf(today), 21);
  await call(A, "POST", "/api/admin/slots", { providerId: "denton", officeId: "maryvale", dates: [day], times: ["7:30 am", "7:45 am"] });
  const open = (await call(null, "GET", `/api/availability?start=${day}&days=1&provider=denton`)).data.days[0].slots;
  const slot = (time) => open.find((item) => item.time === time && item.providerId === "denton");
  const book = (time, insurance) =>
    call(P, "POST", "/api/bookings", {
      slotId: slot(time)?.id,
      reason: "OB-GYN Consultation",
      patientType: "new",
      insurance,
      patient: { email: patient.email, firstName: "Ins", lastName: "Tester", dob: "1990-03-03", sex: "Female", phone: "(623) 555-0142" },
      lang: "en",
    });

  const typed = await book("7:30 am", { carrier: "Banner Medicare Advantage\u0007 Dual", plan: "", memberId: "ABC 123-45", unlisted: false });
  check("a patient can book with insurance typed in by hand", typed.status === 201, `${typed.status} ${typed.text.slice(0, 160)}`);
  const typedDoc = typed.data?.booking ? await db.collection("bookings").findOne({ _id: new ObjectId(typed.data.booking.id) }) : null;
  check(
    "…saved as typed, with the member ID, and marked for a coverage check (whatever the browser claims)",
    typedDoc?.insurance?.carrier === "Banner Medicare Advantage Dual" &&
      typedDoc.insurance.plan === "" &&
      typedDoc.insurance.memberId === "ABC 123-45" &&
      typedDoc.insurance.unlisted === true,
    JSON.stringify(typedDoc?.insurance),
  );

  const listed = await book("7:45 am", { carrier: "Cigna", plan: "PPO", unlisted: true });
  const listedDoc = listed.data?.booking ? await db.collection("bookings").findOne({ _id: new ObjectId(listed.data.booking.id) }) : null;
  check("a carrier from our list is never marked for a check", listed.status === 201 && listedDoc?.insurance?.carrier === "Cigna" && !listedDoc.insurance.unlisted, JSON.stringify(listedDoc?.insurance));

  const detail = await call(A, "GET", `/admin/bookings/${typed.data?.booking?.id}`);
  const detailText = detail.text.replace(/<!-- -->/g, "");
  check(
    "the booking page tells staff to verify coverage and shows the member ID",
    detailText.includes("Not on our list") && detailText.includes("ABC 123-45") && detailText.includes("Banner Medicare Advantage Dual"),
  );
  const list = (await call(A, "GET", "/admin/bookings")).text.replace(/<!-- -->/g, "");
  check("…and the bookings list flags it", list.includes("Banner Medicare Advantage Dual (verify — not on our list)"));

  for (const result of [typed, listed]) {
    if (result.data?.booking?.id) await call(A, "DELETE", `/api/admin/bookings/${result.data.booking.id}`);
  }
}
