import { cookies } from "next/headers";
import { isLang, LANG_COOKIE, type Lang } from "./i18n";

/**
 * The visitor's chosen language for the booking pages (cookie). Without a
 * choice, `fallback` — e.g. the language a booking was made in, so a Spanish
 * patient opening their email link sees Spanish.
 */
export async function getLang(fallback: Lang = "en"): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : fallback;
}
