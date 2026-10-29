/**
 * Where to land after signing in or registering. Never bounce back to an auth
 * page (that's what sent freshly registered users to /login), and never
 * off-site: the value is resolved the way a browser would — so "/\\evil.com",
 * "/%09/evil.com" and other tricks that turn into "//evil.com" are caught —
 * and only a path on this site is kept.
 */
export function safeNext(raw: string | null): string {
  const fallback = "/my-bookings";
  if (!raw || raw.length > 512) return fallback;
  // Backslashes and control characters have no business in a return path.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;

  let url: URL;
  try {
    url = new URL(raw, "https://same-origin.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://same-origin.invalid") return fallback;

  const path = `${url.pathname}${url.search}${url.hash}`;
  if (/^\/(login|register|admin)(\/|\?|$)/.test(path)) return fallback;
  return path;
}
