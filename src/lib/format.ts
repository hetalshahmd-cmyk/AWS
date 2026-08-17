const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Plain helpers, deliberately not in a "use client" file: a server component
 * can't call a function exported from a client module.
 */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Formatted in UTC so the server and client render the same string. */
export function shortDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
