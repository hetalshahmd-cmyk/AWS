// One sign-in page (/login) for patients, providers and admins.
import { jar } from "./lib.mjs";

const signIn = (call, j, body) => call(j, "POST", "/api/auth/session", body);

export async function run({ call, check, db, admin, doctor }) {
  console.log("\n# One sign-in page");

  const old = await call(null, "GET", "/admin/login");
  check("the old staff sign-in address goes to /login", old.status >= 300 && old.status < 400 && (old.headers.get("location") ?? "").endsWith("/login"));

  // Admin
  const A = jar();
  const asAdmin = await signIn(call, A, admin);
  check("an admin signs in on /login and is sent to the admin panel", asAdmin.status === 200 && asAdmin.data.redirect === "/admin");
  check("…with a staff session only, never a patient one", A.cookies.has("aws_admin") && !A.cookies.has("aws_user"));
  check("…and the admin panel opens", (await call(A, "GET", "/admin")).status === 200);

  // Provider
  const D = jar();
  const asDoctor = await signIn(call, D, doctor);
  check("a provider signs in on /login and is sent to their own panel", asDoctor.status === 200 && asDoctor.data.redirect === "/admin/doctor");
  check("…their panel opens", (await call(D, "GET", "/admin/doctor")).status === 200);
  check("…and the full admin stays closed to them", ((await call(D, "GET", "/admin")).headers.get("location") ?? "").endsWith("/admin/doctor"));

  // Patient
  // A demo patient (seed-demo.mjs marks them demo: true; password Demo@2026).
  const patient = await db.collection("users").findOne({ demo: true }, { projection: { email: 1 }, sort: { _id: -1 } });
  const P = jar();
  const asPatient = await signIn(call, P, { email: patient.email, password: "Demo@2026" });
  check("a patient signs in as before", asPatient.status === 200 && asPatient.data.user?.email === patient.email && !asPatient.data.redirect, `${asPatient.status} ${asPatient.text.slice(0, 120)}`);
  check("…with a patient session only", P.cookies.has("aws_user") && !P.cookies.has("aws_admin"));
  check("…and can't open the admin panel", ((await call(P, "GET", "/admin")).headers.get("location") ?? "").endsWith("/login"));

  // Wrong passwords
  const wrong = await signIn(call, jar(), { ...admin, password: "not-the-password" });
  check("a wrong staff password is refused like any other", wrong.status === 401 && wrong.data.error === "Wrong email or password");
  const tate = { email: "tate@arizonawomen.com", password: "wrong-password" };
  const tries = [];
  for (let i = 0; i < 6; i += 1) tries.push((await signIn(call, jar(), tate)).status);
  check("staff addresses keep the tighter limit: 5 wrong tries, then a pause", tries.slice(0, 5).every((s) => s === 401) && tries[5] === 429, tries.join(","));
  check(
    "…even the right password waits out the pause",
    (await signIn(call, jar(), { email: tate.email, password: doctor.password })).status === 429,
  );
}
