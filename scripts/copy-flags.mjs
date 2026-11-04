/**
 * Copies the country flags for the phone field (booking form) into
 * public/flags, so the site serves them itself — no third-party requests.
 * One flag per country libphonenumber-js knows. Run after updating either
 * package:  npm run flags
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCountries } from "libphonenumber-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "node_modules", "country-flag-icons", "3x2");
const to = path.join(root, "public", "flags");

fs.mkdirSync(to, { recursive: true });
let copied = 0;
const missing = [];
for (const country of getCountries()) {
  const file = path.join(from, `${country}.svg`);
  if (!fs.existsSync(file)) {
    missing.push(country);
    continue;
  }
  fs.copyFileSync(file, path.join(to, `${country}.svg`));
  copied += 1;
}
console.log(`Copied ${copied} flags to public/flags${missing.length ? `; no flag for ${missing.join(", ")}` : ""}.`);
