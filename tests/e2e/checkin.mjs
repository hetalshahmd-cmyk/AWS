// Pre-visit check-in: no health questions any more (answers given before are
// kept), photos can be taken or chosen, and staff can download them.
import { arizonaToday, jar, manageToken } from "./lib.mjs";
import { png } from "./doctors.mjs";

const HEALTH = ["allergies", "medications", "conditions", "surgeries", "lmp", "pregnant", "pregnancies"];

export async function run({ call, check, db, admin }) {
  console.log("\n# Check-in form");
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);

  // An upcoming visit whose earlier check-in has health answers (demo data).
  const found = await db.collection("bookings").findOne(
    { status: "confirmed", lang: { $ne: "es" }, date: { $gt: arizonaToday() }, "intake.allergies": { $nin: ["", null] } },
    { sort: { date: 1 } },
  );
  check("there is an upcoming visit with an earlier check-in to test with", Boolean(found));
  if (!found) return;
  // Answers no page could contain by chance (the demo data is random: it can be
  // empty, or "Birth control pill", which the site mentions anyway).
  await db.collection("bookings").updateOne(
    { _id: found._id },
    { $set: { "intake.allergies": "E2E allergy 7731", "intake.medications": "E2E medication 7731" } },
  );
  const booking = await db.collection("bookings").findOne({ _id: found._id });
  const token = manageToken(booking._id.toString());
  const before = Object.fromEntries(HEALTH.map((key) => [key, booking.intake[key]]));

  const page = (await call(null, "GET", `/appointment/${token}/check-in`)).text.replace(/<!-- -->/g, "");
  check("the check-in page has no health questions", !/Health information|Allergies \(|Current medications|menstrual period|past pregnancies/i.test(page));
  check("…and doesn't send the earlier health answers to the browser", !page.includes(String(booking.intake.allergies)) && !page.includes(String(booking.intake.medications)));
  check("…keeps contact and insurance/ID", page.includes("Emergency contact") || page.includes("emergency"));
  check("…and offers Take photo and Choose from your photos", page.includes("Take photo") && page.includes("Choose from your photos"));

  const form = new FormData();
  form.set("phone", "(623) 555-0111");
  form.set("street", "1 Test St");
  form.set("attest", "yes");
  // A form from before the change still sending health answers: ignored.
  form.set("allergies", "SHOULD NOT BE SAVED");
  form.set("pregnancies", "9");
  form.set("photoId", new File([png()], "id.png", { type: "image/png" }));
  const saved = await call(null, "POST", `/api/appointments/${token}/intake`, form);
  const after = (await db.collection("bookings").findOne({ _id: booking._id })).intake;
  check("a check-in saves", saved.status === 200 && after.phone === "(623) 555-0111" && after.street === "1 Test St");
  check("…health answers sent with it are not saved", after.allergies !== "SHOULD NOT BE SAVED" && after.pregnancies !== "9");
  check("…and the answers given before are kept exactly", HEALTH.every((key) => after[key] === before[key]), JSON.stringify(before));

  const detail = (await call(A, "GET", `/admin/bookings/${booking._id}`)).text.replace(/<!-- -->/g, "");
  check("staff still see the earlier health answers, marked as from the old form", detail.includes("Health information (from an earlier check-in form)") && detail.includes(String(before.allergies).slice(0, 12)));
  check("…and the photo with Download and Open full size", detail.includes("Download") && detail.includes("Open full size") && detail.includes(`/api/admin/intake-files/${after.photoIdId}`));

  const view = await call(A, "GET", `/api/admin/intake-files/${after.photoIdId}`);
  check("the photo opens in the browser", view.status === 200 && view.headers.get("content-type") === "image/png" && !view.headers.get("content-disposition"));
  const download = await call(A, "GET", `/api/admin/intake-files/${after.photoIdId}?download=${encodeURIComponent('reyes-2026-11-12-photo-id"; x=1')}`);
  check(
    "Download saves it with a safe file name",
    download.status === 200 && /^attachment; filename="reyes-2026-11-12-photo-id-x-1\.png"$/.test(download.headers.get("content-disposition") ?? ""),
    download.headers.get("content-disposition"),
  );
  check("signed out, the photo stays private", (await call(jar(), "GET", `/api/admin/intake-files/${after.photoIdId}?download=x`)).status === 401);
}
