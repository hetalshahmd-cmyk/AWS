// In a real (headless) Chrome: the booking popup's week view, the ad pixel
// staying off until "Allow", no CSP violations, no JS errors, phone layout.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addDays, arizonaToday, mondayOf, sleep } from "./lib.mjs";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

export async function run({ check, base }) {
  const chromePath = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  console.log("\n# Browser");
  if (!chromePath) {
    console.log("SKIP  no Chrome found (set CHROME_PATH to run the browser checks)");
    return;
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "awsp-e2e-"));
  const port = 9400 + Math.floor(Math.random() * 400);
  const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${port}`, "--disable-gpu", "--no-sandbox", `--user-data-dir=${profile}`, "about:blank"]);
  try {
    let targets;
    for (let i = 0; i < 60 && !targets; i += 1) {
      await sleep(500);
      try {
        targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      } catch {
        /* not up yet */
      }
    }
    const ws = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    let id = 0;
    const pending = new Map();
    const errors = [];
    const facebook = [];
    ws.addEventListener("message", (message) => {
      const event = JSON.parse(message.data);
      if (event.id && pending.has(event.id)) {
        pending.get(event.id)(event);
        pending.delete(event.id);
      } else if (event.method === "Runtime.exceptionThrown") {
        errors.push(event.params.exceptionDetails.exception?.description?.slice(0, 200) ?? "exception");
      } else if (event.method === "Log.entryAdded" && /Content Security Policy|Refused to/i.test(event.params.entry.text)) {
        errors.push(`CSP: ${event.params.entry.text.slice(0, 200)}`);
      } else if (event.method === "Runtime.consoleAPICalled" && event.params.type === "error") {
        const text = event.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
        if (/Content Security Policy|Refused to/i.test(text)) errors.push(`CSP: ${text.slice(0, 200)}`);
      } else if (event.method === "Network.requestWillBeSent" && /facebook|fbcdn/.test(event.params.request.url)) {
        facebook.push(event.params.request.url);
      }
    });
    const send = (method, params = {}) =>
      new Promise((resolve) => {
        id += 1;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    const js = async (expression) =>
      (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result?.value;

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Network.enable");
    await send("Network.setBlockedURLs", { urls: ["*facebook*", "*fbcdn*"] }); // attempts are still recorded
    await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });

    // Ad pixel: nothing until "Allow".
    await send("Page.navigate", { url: `${base}/` });
    await sleep(5000);
    const notice = await js(`document.querySelector('[aria-label="Cookie notice"]')?.innerText ?? ""`);
    check("first visit asks before any ad cookie (Allow / No thanks)", /Allow/.test(notice) && /No thanks/.test(notice));
    check("nothing from Meta before answering", facebook.length === 0 && (await js("typeof window.fbq")) === "undefined");
    await js(`[...document.querySelectorAll('[aria-label="Cookie notice"] button')].find((b) => b.textContent.trim() === 'No thanks').click()`);
    await sleep(1500);

    // Booking popup: Monday–Friday week, office by office, matching the API.
    await send("Page.navigate", { url: `${base}/about#book-tate` });
    await sleep(6000);
    const week = await js(`document.querySelector('[aria-live=polite]')?.textContent ?? ""`);
    const monday = mondayOf(arizonaToday());
    check("the week starts on Monday and ends on Friday", /^Mon/.test(week) && /Fri/.test(week), week);
    await js(`document.querySelector('input[name=booking-office][value=arrowhead]')?.click()`);
    await sleep(2500);
    // The office's header says how many open times the shown week has.
    const shown = Number(
      (await js(`document.querySelector('[role=dialog] section span.rounded-full')?.textContent ?? ""`)).match(/\d+/)?.[0] ?? -1,
    );
    const thisWeek = (await (await fetch(`${base}/api/availability?start=${monday}&days=7&provider=tate&office=arrowhead`)).json()).days.flatMap((day) => day.slots).length;
    // The popup opens on the first week that has open times.
    const firstOpenWeekCount =
      thisWeek > 0 ? thisWeek : (await (await fetch(`${base}/api/availability?start=${addDays(monday, 7)}&days=7&provider=tate&office=arrowhead`)).json()).days.flatMap((day) => day.slots).length;
    check("Glendale shows exactly that week's open times", shown === firstOpenWeekCount, `${shown} shown / ${firstOpenWeekCount} open`);

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Page.navigate", { url: `${base}/about#book-denton` });
    await sleep(5000);
    check("phone: the booking popup fits", !(await js("document.documentElement.scrollWidth > innerWidth + 1")));

    check("no Meta requests at all", facebook.length === 0, `${facebook.length}`);
    check("no JS errors or CSP violations", errors.length === 0, errors.join(" | "));
    ws.close();
  } finally {
    chrome.kill();
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
