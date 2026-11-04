/**
 * Mobile phone numbers on bookings, for any country. Shared by the booking
 * form (browser) and the booking APIs (server), so both accept exactly the
 * same numbers. Rules come from libphonenumber-js (Google's phone metadata).
 */
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

/** The practice is in Arizona: the form starts on the United States. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "US";

/** Shown first in the country list, then the rest A–Z. */
const FIRST: CountryCode[] = ["US", "MX", "IN", "CA"];

export type PhoneCountry = { code: CountryCode; dial: string; name: string };

export function isPhoneCountry(value: unknown): value is CountryCode {
  return typeof value === "string" && (getCountries() as string[]).includes(value);
}

export const dialCode = (country: CountryCode) => `+${getCountryCallingCode(country)}`;

/** 🇺🇸 from "US" — used inside the plain dropdown list. */
export const flagEmoji = (country: string) =>
  String.fromCodePoint(...[...country.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));

/** Every country with a calling code, named in the visitor's language. */
export function phoneCountries(lang = "en"): PhoneCountry[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([lang], { type: "region" });
  } catch {
    names = null;
  }
  const all = getCountries().map((code) => ({ code, dial: dialCode(code), name: names?.of(code) ?? code }));
  const first = FIRST.flatMap((code) => all.filter((item) => item.code === code));
  const rest = all.filter((item) => !FIRST.includes(item.code)).sort((a, b) => a.name.localeCompare(b.name, lang));
  return [...first, ...rest];
}

/**
 * A valid mobile number for `country` (or one typed with its own +code), as
 * staff read it: "(623) 555-0199" for +1 numbers, "+91 98765 43210" for the
 * rest. Null when it isn't a real number for that country.
 */
export function cleanPhone(value: unknown, country: unknown = DEFAULT_PHONE_COUNTRY): string | null {
  if (typeof value !== "string" || value.length > 30) return null;
  if (!/^[\d\s().+-]+$/.test(value.trim())) return null;
  const parsed = parsePhoneNumberFromString(value, isPhoneCountry(country) ? country : DEFAULT_PHONE_COUNTRY);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.countryCallingCode === "1" ? parsed.formatNational() : parsed.formatInternational();
}

/** A tel: link for a cleaned number ("(623) …" numbers are +1). */
export function phoneHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return phone.trim().startsWith("+") ? `tel:+${digits}` : `tel:+1${digits}`;
}
