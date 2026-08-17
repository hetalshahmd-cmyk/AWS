import nextEnv from "@next/env";

/**
 * Load .env.local through Next's own loader rather than `node --env-file`.
 * The two parsers disagree: Next expands `$` (so `pass$123` silently becomes
 * `pass`, and `pass\$123` is the literal), while --env-file does neither. Using
 * Next's loader everywhere means a script and the running app always see the
 * exact same values.
 *
 * One difference on purpose: variables that were already set in the real
 * environment win, so `SMTP_PASS=... npm run doctor` can test the deployed
 * settings. Next's loader overwrites them, so snapshot and restore.
 */
const preset = { ...process.env };

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error: console.error });

for (const [key, value] of Object.entries(preset)) {
  if (value !== undefined) process.env[key] = value;
}
