// Admin → Archive: deleting a booking or a patient archives it; restore it, or
// delete it for good from there. The dashboard's numbers never move.
import { arizonaToday, jar, manageToken } from "./lib.mjs";

/** The big numbers on the dashboard, in order. */
async function kpis(call, A) {
  const html = (await call(A, "GET", "/admin")).text.replace(/<!-- -->/g, "");
  return [...html.matchAll(/text-\[2\.6rem\][^>]*>([^<]*)</g)].map((m) => m[1].trim()).join(" | ");
}

export async function run({ call, check, db, admin, doctor }) {
  console.log("\n# Archive");
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);
  const bookings = db.collection("bookings");
  const before = await kpis(call, A);
  check("the dashboard numbers can be read", before.split(" | ").length >= 4, before);

  // ------------------------------------------------------------ a booking --
  const target = await bookings.findOne(
    { status: "confirmed", archivedAt: null, purgedAt: null, date: { $gt: arizonaToday() } },
    { sort: { date: 1 } },
  );
  const id = target._id.toString();
  const seats = async () => (await db.collection("slots").findOne({ _id: target.slotId })).booked;
  const seatsBefore = await seats();

  const archived = await call(A, "DELETE", `/api/admin/bookings/${id}`);
  check("Delete moves a booking to the Archive", archived.status === 200 && archived.data.archived === true);
  check("…it leaves the bookings list", !(await call(A, "GET", "/api/admin/bookings")).data.bookings.some((b) => b.id === id));
  check("…and is listed in the Archive", (await call(A, "GET", "/api/admin/archive")).data.bookings.some((b) => b.id === id));
  check("…the dashboard numbers don't change", (await kpis(call, A)) === before, await kpis(call, A));
  check("…the appointment keeps its seat", (await seats()) === seatsBefore);
  check(
    "…the patient's appointment link no longer opens it",
    (await call(null, "GET", `/appointment/${manageToken(id)}`)).text.includes("This link isn&#x27;t valid"),
  );
  check("…the Archive page opens", (await call(A, "GET", "/admin/archive")).text.includes("Delete permanently"));
  check("…and the booking's own page says it is archived", (await call(A, "GET", `/admin/bookings/${id}`)).text.includes("This booking is in the Archive"));

  const restored = await call(A, "POST", "/api/admin/archive", { kind: "bookings", action: "restore", ids: [id] });
  check(
    "Restore puts it back in the list",
    restored.status === 200 && restored.data.count === 1 && (await call(A, "GET", "/api/admin/bookings")).data.bookings.some((b) => b.id === id),
  );
  check("…dashboard numbers still the same", (await kpis(call, A)) === before);

  await call(A, "DELETE", `/api/admin/bookings/${id}`);
  const live = (await call(A, "GET", "/api/admin/bookings")).data.bookings[0];
  check(
    "only archived bookings can be deleted for good",
    (await call(A, "POST", "/api/admin/archive", { kind: "bookings", action: "delete", ids: [live.id] })).data.count === 0 &&
      (await call(A, "GET", "/api/admin/bookings")).data.bookings.some((b) => b.id === live.id),
  );
  const purged = await call(A, "POST", "/api/admin/archive", { kind: "bookings", action: "delete", ids: [id] });
  const doc = await bookings.findOne({ _id: target._id });
  check(
    "Delete permanently erases the patient's details",
    purged.status === 200 && purged.data.count === 1 && Boolean(doc.purgedAt) && doc.patient.firstName === "" && doc.patient.email === "" && doc.reason === "" && !doc.userId,
    JSON.stringify(doc.patient),
  );
  check("…keeps only what the dashboard counts", doc.date === target.date && doc.time === target.time && doc.status === target.status && doc.providerId === target.providerId);
  check("…and the dashboard numbers are still the same", (await kpis(call, A)) === before, await kpis(call, A));
  check(
    "…it's gone from the Archive and can't be opened",
    !(await call(A, "GET", "/api/admin/archive")).data.bookings.some((b) => b.id === id) && (await call(A, "GET", `/admin/bookings/${id}`)).status === 404,
  );

  // ------------------------------------------------------------ a patient --
  const user = (await db.collection("users").find({ demo: true }).sort({ _id: -1 }).limit(1).toArray())[0];
  const userId = user._id.toString();
  const P = jar();
  const signIn = (cookies) => call(cookies, "POST", "/api/auth/session", { email: user.email, password: "Demo@2026" });
  check("a demo patient can sign in", (await signIn(P)).status === 200);
  const theirs = await bookings.countDocuments({ archivedAt: null, purgedAt: null, $or: [{ userId: user._id }, { "patient.email": user.email }] });

  const gone = await call(A, "DELETE", `/api/admin/users/${userId}`);
  check("Delete patient moves them to the Archive with their bookings", gone.status === 200 && gone.data.archived === true && gone.data.archivedBookings === theirs, JSON.stringify(gone.data));
  check("…their session ends at once", (await call(P, "GET", "/api/my/bookings")).status === 401);
  check("…they can't sign in", (await signIn(jar())).status === 401);
  check("…they leave the patient list", !(await call(A, "GET", "/api/admin/users")).data.users.some((u) => u.id === userId));
  const inArchive = (await call(A, "GET", "/api/admin/archive")).data.patients.find((p) => p.id === userId);
  check("…and are in the Archive", Boolean(inArchive) && inArchive.bookings === theirs);
  check("…the dashboard numbers don't change", (await kpis(call, A)) === before);

  await call(A, "POST", "/api/admin/archive", { kind: "patients", action: "restore", ids: [userId] });
  check("Restore lets them sign in again, with their bookings back", (await signIn(jar())).status === 200 &&
    (await bookings.countDocuments({ archivedAt: null, purgedAt: null, $or: [{ userId: user._id }, { "patient.email": user.email }] })) === theirs);

  await call(A, "DELETE", `/api/admin/users/${userId}`);
  const erase = await call(A, "POST", "/api/admin/archive", { kind: "patients", action: "delete", ids: [userId] });
  check("Delete patient permanently removes the account", erase.status === 200 && erase.data.count === 1 && !(await db.collection("users").findOne({ _id: user._id })));
  check(
    "…erases their bookings' details and their chats",
    (await bookings.countDocuments({ purgedAt: null, $or: [{ userId: user._id }, { "patient.email": user.email }] })) === 0 &&
      (await db.collection("chat_conversations").countDocuments({ userId: user._id })) === 0,
  );
  check("…and the dashboard numbers are still the same", (await kpis(call, A)) === before, await kpis(call, A));

  // ------------------------------------------------------------- who can --
  const D = jar();
  await call(D, "POST", "/api/admin/session", doctor);
  check("doctors can't see or use the Archive", (await call(D, "GET", "/api/admin/archive")).status === 403 && (await call(D, "POST", "/api/admin/archive", { kind: "bookings", action: "delete", ids: [id] })).status === 403);
}
