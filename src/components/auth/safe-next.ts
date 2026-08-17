/**
 * Where to land after signing in or registering. Never bounce back to an auth
 * page (that's what sent freshly registered users to /login), and never off-site.
 */
export function safeNext(raw: string | null): string {
  if (!raw) return "/my-bookings";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/my-bookings";
  if (/^\/(login|register|admin)(\/|\?|$)/.test(raw)) return "/my-bookings";
  return raw;
}
