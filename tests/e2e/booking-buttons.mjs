// Admin → Doctors → "Show the Book button": Dr. Erickson and Dr. Cook stay on
// the Providers page, but new patients are sent to Kylee or Julie first.
import { addDays, arizonaToday, jar, mondayOf, pageUntil } from "./lib.mjs";

const NOTE = "New patients are first seen by Kylee Tate, PA-C or Julie Denton, FNP.";
const BADGE = "New patients: see Kylee or Julie first";
/** The card's Book button: the calendar icon, then the word. */
const bookButtons = (html) => (html.match(/<\/svg>Book<\/button>/g) ?? []).length;
const profileOf = (db, id) => db.collection("providers").findOne({ _id: id });

export async function run({ call, check, db, admin, doctor }) {
  console.log("\n# Book buttons and new-patient notes");
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);

  const [erickson, cook, tate, denton] = await Promise.all(["erickson", "cook", "tate", "denton"].map((id) => profileOf(db, id)));
  check("Dr. Erickson and Dr. Cook start with no Book button, the new badge and the note", [erickson, cook].every((p) => p.bookable === false && p.badge === BADGE && p.newPatientNote.startsWith(NOTE)));
  check("Kylee and Julie keep their Book buttons", tate.bookable === true && denton.bookable === true && tate.badge === null);

  const about = await pageUntil(call, "/about", (t) => t.includes(BADGE));
  check("the Providers page shows the badge on both cards", (about.match(new RegExp(BADGE, "g")) ?? []).length >= 2);
  check("…and the note under their description", about.includes(NOTE) && about.includes("they will schedule you with Dr. Erickson or Dr. Cook if needed"));
  check("…with Book buttons only on the three providers who take online booking", bookButtons(about) === 3, `found ${bookButtons(about)}`);
  check("…and \"View profile\" on all five", (about.match(/View profile/g) ?? []).length === 5);

  // Online booking can't reach them, even with their own times on the schedule.
  const day = addDays(mondayOf(arizonaToday()), 14);
  await call(A, "POST", "/api/admin/slots", { providerId: "erickson", officeId: "arrowhead", dates: [day], times: ["7:15 am"] });
  await call(A, "POST", "/api/admin/slots", { providerId: "tate", officeId: "arrowhead", dates: [day], times: ["7:15 am"] });
  const times = async (provider) => {
    const result = await call(null, "GET", `/api/availability?start=${day}&days=1&provider=${provider}`);
    return (result.data?.days?.[0]?.slots ?? []).filter((slot) => slot.providerId === provider).length;
  };
  check("patients can't pick Dr. Erickson's times online", (await times("erickson")) === 0);
  check("…while Kylee's times still show", (await times("tate")) > 0);
  const anyone = await call(null, "GET", `/api/availability?start=${day}&days=1`);
  check("…and \"first available\" never offers Dr. Erickson", !(anyone.data?.days?.[0]?.slots ?? []).some((slot) => slot.providerId === "erickson"));

  // The switch in Admin → Doctors
  const save = (profile, changes) => {
    const { _id, updatedAt, order, photo, photoUrl, zocdocCheckedAt, ...rest } = profile;
    void [_id, updatedAt, order, photo, photoUrl, zocdocCheckedAt];
    return call(A, "PATCH", `/api/admin/doctors/${profile._id}`, { ...rest, ...changes });
  };
  const on = await save(erickson, { bookable: true, badge: "", newPatientNote: "" });
  check("an admin can switch the Book button back on and clear the notes", on.status === 200 && on.data.provider.bookable === true && on.data.provider.badge === null && on.data.provider.newPatientNote === null);
  check("…then Dr. Erickson's times can be booked online", (await times("erickson")) > 0);
  const off = await save(erickson, { bookable: false, badge: BADGE, newPatientNote: erickson.newPatientNote });
  check("…and off again", off.status === 200 && off.data.provider.bookable === false && (await times("erickson")) === 0);
  const D = jar();
  await call(D, "POST", "/api/admin/session", doctor);
  check("a doctor can't change these settings", (await call(D, "PATCH", "/api/admin/doctors/erickson", { bookable: true })).status === 403);

  // A database from before these settings: filled in once from the seed list, never overwritten.
  await db.collection("providers").updateOne({ _id: "cook" }, { $unset: { bookable: "", badge: "", newPatientNote: "" } });
  await db.collection("providers").updateOne({ _id: "shah" }, { $unset: { bookable: "" } });
  await save(denton, {}); // any save reloads the providers
  const [cookAfter, shahAfter] = await Promise.all([profileOf(db, "cook"), profileOf(db, "shah")]);
  check("older profiles get the settings once: Dr. Cook without online booking", cookAfter.bookable === false && cookAfter.badge === BADGE && cookAfter.newPatientNote?.startsWith(NOTE));
  check("…everyone else bookable as before", shahAfter.bookable === true);
}
