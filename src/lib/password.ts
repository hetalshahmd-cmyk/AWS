import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// scrypt is in Node core, so no bcrypt/argon dependency to install or rebuild.
// N = 2^17, r = 8: OWASP's minimum for scrypt (128 MB, ~0.3 s per hash).
// Hashes made with a smaller N still verify and are upgraded on the next
// sign-in (see needsRehash).
const N = 131072;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 256 * 1024 * 1024;

/** Returns `scrypt$N$r$p$salt$hash`, all base64url. Salt is per-password. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/** A well-formed hash for no account — verified against so timing doesn't reveal unknown emails. */
export const DUMMY_HASH = `scrypt$${N}$8$1$AAAAAAAAAAAAAAAAAAAAAA$${"A".repeat(86)}`;

/** True when a stored hash uses weaker settings than today's. */
export function needsRehash(stored: string): boolean {
  const parts = stored?.split("$") ?? [];
  return parts.length === 6 && parts[0] === "scrypt" && (Number(parts[1]) < N || Number(parts[2]) < R);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored?.split("$") ?? [];
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltPart, keyPart] = parts;
  const salt = Buffer.from(saltPart, "base64url");
  const expected = Buffer.from(keyPart, "base64url");

  try {
    const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
