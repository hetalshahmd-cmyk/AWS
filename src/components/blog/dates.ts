/** "October 29, 2026" — the date as Arizona saw it. */
export function formatArticleDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Phoenix",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "2026-10-29" in Arizona, for <time dateTime>. */
export function articleDateValue(iso: string): string {
  return new Date(new Date(iso).getTime() - 7 * 3600e3).toISOString().slice(0, 10);
}
