/**
 * Fresh screenshots of the whole system, on a throwaway demo database.
 *
 *   npm run screenshots              uses the last `next build` (builds if there is none)
 *   npm run screenshots -- --build   build first
 *
 * Same safety as the end-to-end tests: MONGODB_URI must be this machine, only
 * the "arizona_e2e" database is touched (dropped before and after), mail goes
 * to a local fake server and Meta is blocked. Output: screenshots/full-system/.
 */
import "./load-env.mjs";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "screenshots", "full-system");
const DB = "arizona_e2e";
const PORT = 3112;
const SMTP_PORT = 2527;
const BASE = `http://localhost:${PORT}`;
const ADMIN = { email: "admin@demo.test", password: "Demo-admin-pass-1" };
const DOCTOR = { email: "denton@arizonawomen.com", password: "Demo-doctor-pass-1" };
const NEXT_BIN = path.join(root, "node_modules", "next", "dist", "bin", "next");
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => p && fs.existsSync(p));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const uri = process.env.MONGODB_URI ?? "";
const host = (() => {
  try {
    return new URL(uri).hostname;
  } catch {
    return "";
  }
})();
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to run: MONGODB_URI must point at this machine (got "${host || "nothing"}").`);
  process.exit(1);
}
if (!CHROME) {
  console.error("No Chrome found — set CHROME_PATH.");
  process.exit(1);
}

const run = (args, env = {}) => {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`failed: node ${args.join(" ")}`);
};
const dropDb = async () => {
  const mongo = await MongoClient.connect(uri);
  await mongo.db(DB).dropDatabase();
  await mongo.close();
};
const waitFor = async (check) => {
  for (let i = 0; i < 120; i += 1) {
    try {
      if (await check()) return;
    } catch {
      /* not yet */
    }
    await sleep(500);
  }
  throw new Error("timed out");
};

const captions = [];
let server;
let sink;
let chrome;
const mailDir = fs.mkdtempSync(path.join(os.tmpdir(), "awsp-shots-mail-"));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "awsp-shots-chrome-"));

try {
  if (process.argv.includes("--build") || !fs.existsSync(path.join(root, ".next", "BUILD_ID"))) run([NEXT_BIN, "build"]);
  await dropDb();
  run(["scripts/seed.mjs", "--email", ADMIN.email, "--password", ADMIN.password, "--name", "Front Desk", "--doctors", "--doctor-password", DOCTOR.password], { MONGODB_DB: DB });
  run(["scripts/seed-demo.mjs"], { MONGODB_DB: DB });

  sink = spawn(process.execPath, [path.join(root, "tests/e2e/smtp-sink.mjs"), mailDir, String(SMTP_PORT)], { stdio: "ignore" });
  server = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(PORT)], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      MONGODB_DB: DB,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(SMTP_PORT),
      SMTP_SECURE: "false",
      SMTP_USER: "sink@example.com",
      SMTP_PASS: "sinkpass",
      SMTP_FROM: "Arizona Women Specialists <info@example.com>",
      META_CAPI_ACCESS_TOKEN: "disabled-for-test",
    },
  });
  await waitFor(async () => (await fetch(BASE)).ok);

  const mongo = await MongoClient.connect(uri);
  // A demo patient with an account and an upcoming visit, so the panel has something to show.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix" }).format(new Date());
  const emails = (await mongo.db(DB).collection("users").find({}, { projection: { email: 1 } }).toArray()).map((u) => u.email);
  const upcoming = await mongo.db(DB).collection("bookings").findOne({ "patient.email": { $in: emails }, userId: { $ne: null }, status: "confirmed", date: { $gt: today } });
  const patient = { email: upcoming?.patient.email ?? emails[0] };
  await mongo.close();

  const port = 9800 + Math.floor(Math.random() * 100);
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, "--disable-gpu", "--no-sandbox", "--hide-scrollbars", `--user-data-dir=${profile}`, "about:blank"]);
  let targets;
  await waitFor(async () => (targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()));
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (message) => {
    const event = JSON.parse(message.data);
    if (event.id && pending.has(event.id)) {
      pending.get(event.id)(event);
      pending.delete(event.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      id += 1;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const js = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result?.value;
  const viewport = (width, height, mobile = false) =>
    send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
  const go = async (url, wait = 3500) => {
    await send("Page.navigate", { url: "about:blank" });
    await send("Page.navigate", { url: BASE + url });
    await sleep(wait);
    // Signing in and out clears the consent cookie, so answer the notice again.
    if (await clickText('[aria-label="Cookie notice"] button', /^No thanks$/)) await sleep(600);
  };
  const shot = async (name, caption, { full = false } = {}) => {
    let params = { format: "png" };
    if (full) {
      // Scroll through once so lazy pictures load and reveal animations run.
      await js(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); })()`);
      await sleep(1200);
      const { cssContentSize: size } = (await send("Page.getLayoutMetrics")).result;
      params = { ...params, captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: Math.min(size.height, 12000), scale: 1 } };
    }
    const { data } = (await send("Page.captureScreenshot", params)).result;
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
    captions.push(`${name}.png — ${caption}`);
    console.log(`  ${name}.png`);
  };
  const signIn = (api, body) =>
    js(`fetch(${JSON.stringify(api)}, {method: "POST", headers: {"content-type": "application/json"}, body: ${JSON.stringify(JSON.stringify(body))}}).then((r) => r.status)`);
  const clickText = (scope, pattern) =>
    js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope)})].find((el) => ${pattern}.test(el.textContent.trim())); b?.click(); return !!b; })()`);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["*facebook*", "*fbcdn*"] });

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  console.log("\nCapturing:");

  // Public site
  await viewport(1366, 900);
  await send("Page.navigate", { url: BASE + "/" });
  await sleep(3500);
  await shot("01-cookie-notice", "First visit — the ad cookie notice; nothing from Meta loads unless the visitor chooses Allow");
  await clickText('[aria-label="Cookie notice"] button', /^No thanks$/);
  await sleep(800);
  await shot("02-home", "Home page — every Book button leads to the providers", { full: true });
  await go("/about");
  await shot("03-providers", "Providers page — a card per provider (from Admin → Doctors) with View profile, Book, Zocdoc and eCW", { full: true });
  await go("/about#provider-shah");
  await shot("04-provider-profile", "View profile — the full profile in a popup: about, education, certifications, focus, Zocdoc rating");
  await go("/about#book-tate", 6000);
  await shot("05-booking-week", "Book — the booking form opens on the same page: office radio buttons and a Monday–Friday week of open times");
  await js(`document.querySelector('input[name=booking-office][value=arrowhead]')?.click()`);
  await sleep(2500);
  await shot("06-booking-other-office", "Switching office — that office's week and how many open times it has");
  if (await clickText("[role=dialog] button", /^\d{1,2}:\d{2}\s?(am|pm)$/i)) {
    await sleep(1500);
    await shot("07-booking-visit-details", "After picking a time — visit details: that provider's visit reasons (Zocdoc's list), insurance, new or existing patient");
  }
  await go("/book", 5000);
  await shot("08-book-page", "Booking page — providers with their open times", { full: true });

  await viewport(390, 844, true);
  await go("/about#book-denton", 6000);
  await shot("09-phone-booking", "Phone — the booking form fits the screen");
  await go("/about");
  await shot("10-phone-providers", "Phone — Providers page");

  // Patient
  await viewport(1366, 900);
  if (patient) {
    await go("/login", 2000);
    await signIn("/api/auth/session", { email: patient.email, password: "Demo@2026" });
    await go("/my-bookings", 4000);
    await shot("20-patient-panel", "Patient panel — overview, appointments (upcoming / past / cancelled), profile and password", { full: true });
    await viewport(390, 844, true);
    await go("/my-bookings", 4000);
    await shot("21-patient-panel-phone", "Patient panel on a phone", { full: true });
    await viewport(1366, 900);
  }
  await send("Network.clearBrowserCookies");

  // Staff
  await go("/admin/login", 2500);
  await shot("30-staff-sign-in", "Staff sign-in");
  await signIn("/api/admin/session", ADMIN);
  const admin = [
    ["31-admin-dashboard", "/admin", "Admin dashboard"],
    ["32-admin-slots", "/admin/slots", "Appointment slots — the fixed weekly schedule; change one week, go back to the fixed schedule, or change the fixed schedule"],
    ["33-admin-bookings", "/admin/bookings", "Bookings — filters, status, details"],
    ["34-admin-patients", "/admin/users", "Patients"],
    ["35-admin-doctors", "/admin/doctors", "Doctors — every provider, on the website or hidden, with sign-in, schedule and Zocdoc warnings"],
    ["36-admin-doctor-editor", "/admin/doctors/denton", "One provider — photo, profile, Zocdoc and eCW, visit reasons, their weekly schedule, sign-in email and password"],
    ["37-admin-settings", "/admin/settings", "Settings — your own name, email and password; add, reset or remove admins"],
    ["37b-admin-modify-site", "/admin/site", "Modify site — the home page hero (words, pictures, focus points) and the office cards (name, address, phone, directions, picture)"],
    ["38-admin-pricing", "/admin/pricing", "Pricing cards editor"],
  ];
  for (const [name, url, caption] of admin) {
    await go(url, 4000);
    await shot(name, caption, { full: true });
  }
  await viewport(390, 844, true);
  await go("/admin", 4000);
  await shot("39-admin-phone", "Admin on a phone");
  await viewport(1366, 900);
  await send("Network.clearBrowserCookies");

  await go("/admin/login", 2000);
  await signIn("/api/admin/session", DOCTOR);
  await go("/admin/doctor", 4000);
  await shot("40-provider-panel", "A provider's own panel — only their appointments", { full: true });

  ws.close();

  fs.writeFileSync(
    path.join(OUT, "README.txt"),
    [
      "Arizona Women Specialists — screenshots",
      `Captured ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC on a throwaway demo database (demo patients, not real data).`,
      "Recreate with: npm run screenshots   (local MongoDB only; the demo database is deleted afterwards)",
      "",
      ...captions,
      "",
    ].join("\n"),
  );
  console.log(`\n${captions.length} screenshots in screenshots/full-system/`);
} finally {
  chrome?.kill();
  server?.kill();
  sink?.kill();
  await sleep(800);
  await dropDb().catch(() => undefined);
  fs.rmSync(mailDir, { recursive: true, force: true });
  fs.rmSync(profile, { recursive: true, force: true });
}
