import nextEnv from "@next/env";

/**
 * Load .env.local through Next's own loader rather than `node --env-file`.
 * The two parsers disagree: Next expands `$` (so `pass$123` silently becomes
 * `pass`, and `pass\$123` is the literal), while --env-file does neither. Using
 * Next's loader everywhere means a script and the running app always see the
 * exact same values.
 */
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error: console.error });
