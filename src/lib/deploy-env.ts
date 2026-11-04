/**
 * Which kind of deployment this is, and what a preview may do.
 *
 * Vercel sets VERCEL_ENV itself on every deployment — "production" for the
 * live site, "preview" for any other branch or pull request, "development"
 * for `vercel dev`. It is not set on a developer machine or in CI.
 *
 * A preview is a copy of the site anyone with its link might open, so it is
 * kept away from real patients: it must use a staging database, it sends no
 * email except to staff addresses listed for testing, sends nothing to Meta,
 * and runs no scheduled jobs. Every check fails closed.
 */

type Env = Record<string, string | undefined>;

export function isPreviewDeploy(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development";
}

/** Database names a preview may use: they must say they are not production. */
export const STAGING_DB = /(?:^|[_-])(?:staging|preview)$/i;

/** Why this deployment may not use its database, or null if it may. */
export function databaseProblem(env: Env = process.env): string | null {
  if (!isPreviewDeploy(env)) return null;
  const name = env.MONGODB_DB ?? "";
  if (!STAGING_DB.test(name)) {
    return (
      `Preview deployments must use a staging database: MONGODB_DB is "${name || "(unset)"}". ` +
      'Set MONGODB_DB (and MONGODB_URI) for the Preview environment to a staging database whose name ends in "_staging".'
    );
  }
  if (env.STAGING_DATABASE_CONFIRMED !== "1") {
    return "Preview deployments need STAGING_DATABASE_CONFIRMED=1, set only on the Preview environment, after checking MONGODB_URI points at the staging cluster.";
  }
  return null;
}

/**
 * May this deployment email `to`? Production and local machines: yes. A
 * preview: only addresses in PREVIEW_MAIL_ALLOWLIST (comma-separated staff
 * test inboxes) — never a patient.
 */
export function mailAllowed(to: string, env: Env = process.env): boolean {
  if (!isPreviewDeploy(env)) return true;
  const allowed = (env.PREVIEW_MAIL_ALLOWLIST ?? "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(to.trim().toLowerCase());
}
