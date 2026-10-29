// Admin → Doctors and Admin → Settings. Runs last: it changes the admin's password.
import zlib from "node:zlib";
import { addDays, arizonaToday, jar, mondayOf, pageUntil } from "./lib.mjs";

/** A real 2×2 PNG for the photo upload. */
export function png() {
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.from([0, 255, 0, 255, 255, 0, 255, 0, 255, 0, 255, 255, 0, 255]);
  return new Uint8Array(
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]),
  );
}

export async function run({ call, check, base, admin, doctor }) {
  const today = arizonaToday();
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);

  console.log("\n# Doctors");
  const list = await call(A, "GET", "/api/admin/doctors");
  check("lists the doctors with their sign-ins", list.data?.providers?.length === 5 && list.data.logins.denton === doctor.email);
  const D = jar();
  await call(D, "POST", "/api/admin/session", doctor);
  check("a doctor can't use the doctors API", (await call(D, "GET", "/api/admin/doctors")).status === 403);

  const julie = list.data.providers.find((p) => p.id === "denton");
  const edited = await call(A, "PATCH", "/api/admin/doctors/denton", { ...julie, cred: "Women's Health Nurse Practitioner", languages: "English, Spanish, Portuguese" });
  check("save Julie's title and languages", edited.status === 200 && edited.data.provider.languages.length === 3);
  check("…the booking page shows it", (await pageUntil(call, "/book", (t) => t.includes("Portuguese"))).includes("Portuguese"));
  const bad = await Promise.all([
    call(A, "PATCH", "/api/admin/doctors/denton", { ...julie, zocdocUrl: "javascript:alert(1)" }),
    call(A, "PATCH", "/api/admin/doctors/denton", { ...julie, npi: "12345" }),
    call(A, "PATCH", "/api/admin/doctors/denton", { ...julie, zocdocRating: "9" }),
  ]);
  check("bad links, NPI and rating refused", bad.every((r) => r.status === 400));
  const checkedNow = await call(A, "PATCH", "/api/admin/doctors/denton", { ...edited.data.provider, languages: "English, Spanish", zocdocCheckedNow: true });
  check("'I checked Zocdoc today' records the date", checkedNow.data?.provider?.zocdocCheckedAt === today);

  const created = await call(A, "POST", "/api/admin/doctors", {
    name: "Dr. Maria Lopez, MD",
    cred: "Obstetrician & Gynecologist",
    languages: "English, Spanish",
    about: ["Test bio."],
    npi: "1234567890",
  });
  check("add a doctor", created.status === 201 && created.data.provider.id === "lopez" && created.data.provider.cta === "Book with Dr. Lopez");
  const photo = new FormData();
  photo.set("photo", new File([png()], "lopez.png", { type: "image/png" }));
  const up = await call(A, "POST", "/api/admin/doctors/lopez/photo", photo);
  check("upload her photo", up.status === 200 && /^\/api\/provider-photos\/[a-f\d]{24}$/.test(up.data?.provider?.photoUrl ?? ""));
  check("the photo is served as an image", (await fetch(base + up.data.provider.photoUrl)).headers.get("content-type") === "image/png");
  const fake = new FormData();
  fake.set("photo", new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.png", { type: "image/png" }));
  check("a non-image named .png is refused", (await call(A, "POST", "/api/admin/doctors/lopez/photo", fake)).status === 400);

  const reasons = await call(A, "PUT", "/api/admin/doctors/lopez/reasons", { reasons: ["OB-GYN Consultation", "Prenatal Care"] });
  check("set her visit reasons", reasons.status === 200 && reasons.data.reasons.length === 2);
  check("no reasons at all is refused", (await call(A, "PUT", "/api/admin/doctors/lopez/reasons", { reasons: [] })).status === 400);

  check("create her sign-in", (await call(A, "PUT", "/api/admin/doctors/lopez/login", { email: "lopez@arizonawomen.com", password: "Lopez-pass-2026" })).status === 200);
  check("short passwords refused", (await call(A, "PUT", "/api/admin/doctors/lopez/login", { email: "lopez@arizonawomen.com", password: "short" })).status === 400);
  check("another staff email refused", (await call(A, "PUT", "/api/admin/doctors/lopez/login", { email: doctor.email })).status === 400);
  const L = jar();
  await call(L, "POST", "/api/admin/session", { email: "lopez@arizonawomen.com", password: "Lopez-pass-2026" });
  const panel = await call(L, "GET", "/admin/doctor");
  check("she signs in to her own panel", panel.status === 200 && panel.text.includes("Maria Lopez"));

  const nextMon = addDays(mondayOf(today), 7);
  await call(A, "POST", "/api/admin/slots", { providerId: "lopez", officeId: "arrowhead", dates: [nextMon], times: ["9:00 am", "11:00 am"] });
  const avail = await call(null, "GET", `/api/availability?start=${nextMon}&days=1&provider=lopez`);
  check("patients see her times", (avail.data?.days?.[0]?.slots ?? []).length === 2);
  check("she appears on the Providers page", (await pageUntil(call, "/about", (t) => t.includes('id="provider-lopez"'))).includes('id="provider-lopez"'));

  const L2 = jar();
  await call(L2, "POST", "/api/admin/session", { email: "lopez@arizonawomen.com", password: "Lopez-pass-2026" });
  await call(A, "PUT", "/api/admin/doctors/lopez/login", { email: "lopez@arizonawomen.com", password: "Lopez-new-pass-2026" });
  check("a new password signs her out everywhere", ((await call(L2, "GET", "/admin/doctor")).headers.get("location") ?? "").includes("/admin/login"));
  await call(A, "DELETE", "/api/admin/doctors/lopez/login");
  check("removing her sign-in stops it", (await call(jar(), "POST", "/api/admin/session", { email: "lopez@arizonawomen.com", password: "Lopez-new-pass-2026" })).status === 401);

  const kylee = list.data.providers.find((p) => p.id === "tate");
  await call(A, "PATCH", "/api/admin/doctors/tate", { ...kylee, active: false });
  check("a hidden doctor leaves the Providers page", !(await pageUntil(call, "/about", (t) => !t.includes('id="provider-tate"'))).includes('id="provider-tate"'));
  const anySlots = (await call(null, "GET", `/api/availability?start=${today}&days=14`)).data.days.flatMap((d) => d.slots);
  check("…and her times can't be found", !anySlots.some((s) => s.providerId === "tate"));
  await call(A, "PATCH", "/api/admin/doctors/tate", { ...kylee, active: true });

  console.log("\n# Settings");
  check("rename without a password", (await call(A, "PATCH", "/api/admin/account", { name: "Front Desk Lead" })).data?.account?.name === "Front Desk Lead");
  check("password change needs the current one", (await call(A, "PATCH", "/api/admin/account", { newPassword: "Another-pass-2026", currentPassword: "nope" })).status === 400);
  const other = jar();
  await call(other, "POST", "/api/admin/session", admin);
  const changed = await call(A, "PATCH", "/api/admin/account", { newPassword: "Another-pass-2026", currentPassword: admin.password });
  check("password changed; this browser stays in", changed.status === 200 && (await call(A, "GET", "/api/admin/doctors")).status === 200);
  check("…the other browser is out", (await call(other, "GET", "/api/admin/doctors")).status === 401);
  const added = await call(A, "POST", "/api/admin/admins", { name: "Second", email: "second@e2e.test", password: "Second-pass-2026" });
  check("add another admin", added.status === 201);
  check("can't remove yourself", (await call(A, "DELETE", `/api/admin/admins/${changed.data.account.id}`)).status === 400);
  check("remove the other admin", (await call(A, "DELETE", `/api/admin/admins/${added.data.admin.id}`)).status === 200);
}
