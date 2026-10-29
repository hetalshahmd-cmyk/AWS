// Shared helpers for the end-to-end suites (see tests/e2e/run.mjs).
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Collects pass/fail lines; run.mjs prints the total and sets the exit code. */
export function reporter() {
  const results = [];
  const check = (name, ok, detail = "") => {
    results.push({ name, ok: Boolean(ok) });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  };
  return { check, results };
}

let ipCounter = 0;
/**
 * A cookie jar with its own client IP (the test server runs with
 * TRUST_PROXY_HEADERS=1), so one suite's rate limits never block another's.
 */
export function jar() {
  ipCounter += 1;
  return { cookies: new Map(), ip: `10.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}.7` };
}

export function client(base) {
  return async function call(j, method, url, body, extra = {}) {
    const headers = { ...extra };
    if (j) {
      headers["x-forwarded-for"] = j.ip;
      if (j.cookies.size) headers.cookie = [...j.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    let payload;
    if (body instanceof FormData) payload = body;
    else if (typeof body === "string") {
      headers["content-type"] = "application/json";
      payload = body;
    } else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const response = await fetch(base + url, { method, headers, body: payload, redirect: "manual" });
    if (j) {
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const index = pair.indexOf("=");
        const name = pair.slice(0, index);
        const value = pair.slice(index + 1);
        if (!value || /max-age=0/i.test(cookie)) j.cookies.delete(name);
        else j.cookies.set(name, value);
      }
    }
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: response.status, data, text, headers: response.headers };
  };
}

/** The 6-digit code most recently emailed to `to` after `after` (ms). */
export async function codeFor(mailDir, to, after) {
  for (let i = 0; i < 30; i += 1) {
    const files = fs.existsSync(mailDir)
      ? fs.readdirSync(mailDir).map((file) => path.join(mailDir, file)).filter((file) => fs.statSync(file).mtimeMs > after)
      : [];
    for (const file of files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)) {
      const body = fs.readFileSync(file, "utf8");
      if (body.includes(to)) return { code: body.match(/\b(\d{6})\b/)?.[1] ?? null, body };
    }
    await sleep(500);
  }
  return { code: null, body: "" };
}

/** Same signing as src/lib/booking-links.ts, so tests can open any booking's link. */
export function manageToken(bookingId) {
  const signature = createHmac("sha256", `${process.env.SESSION_SECRET}:manage-appointment`)
    .update(bookingId)
    .digest("base64url")
    .slice(0, 32);
  return `${bookingId}.${signature}`;
}

/** Today in Arizona (UTC-7, no daylight saving). */
export const arizonaToday = () => new Date(Date.now() - 7 * 3600e3).toISOString().slice(0, 10);

export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const mondayOf = (iso) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));

/** Fetches a page until `test` passes (pages may take a moment to show a change). */
export async function pageUntil(call, url, test, tries = 8) {
  let text = "";
  for (let i = 0; i < tries; i += 1) {
    text = (await call(null, "GET", url)).text.replace(/<!-- -->/g, "");
    if (test(text)) return text;
    await sleep(1500);
  }
  return text;
}
