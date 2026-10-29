// The fixed weekly schedule: weeks follow it, a changed week keeps its
// changes, booked times survive, extra times added early are kept.
import { addDays, arizonaToday, jar, mondayOf } from "./lib.mjs";

const sig = (rows) =>
  JSON.stringify([...rows].map((row) => `${row.weekday}|${row.officeId}|${row.providerId}|${row.times.join(",")}`).sort());

export async function run({ call, check, admin }) {
  console.log("\n# Fixed weekly schedule");
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);
  const monday = mondayOf(arizonaToday());
  const [next, after, third] = [7, 14, 21].map((days) => addDays(monday, days));
  const slotsOn = async (date, provider) =>
    (await call(null, "GET", `/api/availability?start=${date}&days=1&provider=${provider}`)).data.days[0]?.slots ?? [];

  const master = (await call(A, "GET", `/api/admin/schedule?week=${monday}`)).data.template;
  check("fixed schedule = the practice's week (12 rows)", master.length === 12, `${master.length} rows`);
  const w2 = (await call(A, "GET", `/api/admin/schedule?week=${next}`)).data;
  check("next week follows it", w2.source === "saved" && w2.custom === false && sig(w2.rows) === sig(master));
  const friShah = (await slotsOn(addDays(next, 4), "shah")).map((slot) => slot.time).join(",");
  check("next Friday: Dr. Shah's exact times", friShah === "8:30 am,10:00 am,11:00 am,1:00 pm,2:00 pm,3:00 pm", friShah);

  // An extra time added to a week before it has a plan survives the fill.
  const far = addDays(monday, 70);
  const extra = await call(A, "POST", "/api/admin/slots", { providerId: "tate", officeId: "maryvale", dates: [addDays(far, 5)], times: ["7:00 am"] });
  const farWeek = (await call(A, "GET", `/api/admin/schedule?week=${far}`)).data;
  check(
    "an extra time added early is kept when the week is filled",
    extra.status === 201 && farWeek.rows.some((row) => row.weekday === 6 && row.times.includes("7:00 am")),
  );

  const noKyleeFri = master.filter((row) => !(row.weekday === 5 && row.providerId === "tate"));
  await call(A, "PUT", "/api/admin/schedule", { week: after, rows: noKyleeFri });
  check("change one week only", (await call(A, "GET", `/api/admin/schedule?week=${after}`)).data.custom === true);

  const patient = jar();
  await call(patient, "POST", "/api/auth/session", { email: "valeria.reyes@example.com", password: "Demo@2026" });
  const tue = addDays(next, 1);
  const target = (await slotsOn(tue, "tate")).find((slot) => slot.time === "8:00 am");
  const booked = target
    ? await call(patient, "POST", "/api/bookings", {
        slotId: target.id,
        reason: "OB-GYN Consultation",
        patientType: "existing",
        insurance: null,
        patient: { email: "x@example.com", firstName: "Test", lastName: "Patient", dob: "1992-02-02", sex: "Female" },
        lang: "en",
      })
    : { status: 0 };
  check("a patient books Kylee next Tuesday 8:00 am", booked.status === 201, `${booked.status}`);

  const changed = master.map((row) =>
    row.weekday === 2 && row.providerId === "tate" ? { ...row, times: ["9:00 am", "10:00 am", "1:00 pm", "3:00 pm"] } : row,
  );
  const saved = await call(A, "PUT", "/api/admin/schedule", { master: true, rows: changed });
  check("save a new fixed schedule", saved.status === 200 && saved.data.weeks.includes(next) && !saved.data.weeks.includes(after));
  const tueTimes = (await slotsOn(tue, "tate")).map((slot) => slot.time).join(",");
  check("next Tuesday follows it (9:00 am in, 8:00 am out)", tueTimes.includes("9:00 am") && !tueTimes.includes("8:00 am"), tueTimes);
  check("the booked 8:00 am was kept and reported", saved.data.keptBooked.some((item) => item.date === tue && item.time === "8:00 am"));
  check("the changed week kept its own changes", sig((await call(A, "GET", `/api/admin/schedule?week=${after}`)).data.rows) === sig(noKyleeFri));
  check("a later week follows the new fixed schedule", sig((await call(A, "GET", `/api/admin/schedule?week=${third}`)).data.rows) === sig(changed));
  await call(A, "PUT", "/api/admin/schedule", { week: after, reset: true });
  check("'use the fixed schedule again' works", (await call(A, "GET", `/api/admin/schedule?week=${after}`)).data.custom === false);
  const restore = await call(A, "PUT", "/api/admin/schedule", { master: true, rows: master });
  check("practice's schedule restored", restore.status === 200);
}
