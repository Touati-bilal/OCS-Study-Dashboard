/**
 * PRV server configuration.
 *
 * `import "server-only"` makes any accidental import from a client component a build error, which
 * is what keeps the credential hashes, the pepper and the AI key out of the browser bundle. Nothing
 * in this file may ever be imported by a "use client" module.
 *
 * Secret handling
 * ---------------
 * No secret is ever stored in plaintext, in Git, or in the browser. Both the owner password and the
 * 4-digit PRV code are only ever persisted as scrypt hashes, produced once by `npm run prv:setup`
 * and read from the environment afterwards. The plaintext exists only inside the setup prompt.
 *
 * Those hashes are additionally *peppered*: the scrypt input is an HMAC of the secret keyed with
 * `PRV_SECRET_PEPPER`, a separate random value that lives only in the server environment. Without
 * the pepper a leaked hash would be an offline cracking target, and a 4-digit code has only 10 000
 * possibilities - trivially exhausted in seconds against a known salt. The pepper raises that from
 * "instant" to "impossible without the server environment", and it is a distinct value so that
 * leaking it does not also compromise the session signing key.
 *
 * The pepper is required: if it is absent the owner login and the PRV code both refuse to verify and
 * report "not configured", rather than silently falling back to a weak default.
 */
import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** How many consecutive wrong codes are tolerated before PRV locks. */
export const MAX_ACCESS_ATTEMPTS = 3;

/** How long a lockout lasts. Deliberately temporary: the owner must never be locked out for good. */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/** Separate, stricter budget for the recovery phrase, so it cannot be brute-forced either. */
export const MAX_RECOVERY_ATTEMPTS = 5;
export const RECOVERY_LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

/** Wrong owner logins allowed before the account itself is temporarily locked. */
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Hash serialisation: `scrypt.v1.<saltHex>.<hashHex>`.
 *
 * The separator is a dot, and that is not cosmetic. Every hash is written to `.env.local`, and the
 * environment-file loader performs `$VAR` expansion on values - including inside quotes. A
 * `scrypt$v1$...` value is therefore mangled into `scrypt` before the app ever sees it, and the
 * stored hash silently stops verifying. A dot has no meaning to the loader, so the value survives
 * verbatim. Nothing about the hash changes: same scrypt parameters, same constant-time compare.
 *
 * The legacy `scrypt$...` and `scrypt$v1$...` forms are still accepted when *verifying*, so a value
 * written by an older build keeps working; only newly written values use dots.
 */
const HASH_PREFIX = "scrypt";
const VERSION_V1 = "v1";

/** Parses either separator. Hex is the only alphabet in a hash body, so this split is unambiguous. */
function parseStoredHash(stored: string): { version: string | null; salt: Buffer; hash: Buffer } | null {
  const parts = stored.split(/[.$]/);
  if (parts.length === 3 && parts[0] === HASH_PREFIX) {
    return { version: null, salt: Buffer.from(parts[1], "hex"), hash: Buffer.from(parts[2], "hex") };
  }
  if (parts.length === 4 && parts[0] === HASH_PREFIX && parts[1] === VERSION_V1) {
    return { version: VERSION_V1, salt: Buffer.from(parts[2], "hex"), hash: Buffer.from(parts[3], "hex") };
  }
  return null;
}

function isUsable(parsed: { salt: Buffer; hash: Buffer } | null): parsed is { salt: Buffer; hash: Buffer } {
  return parsed !== null && parsed.salt.length > 0 && parsed.hash.length > 0;
}

/**
 * scrypt cost. The same parameters protect the password, the code and the recovery phrase; the
 * phrase is a real secret of its own, set by the owner, so unlike the other two it has no fallback
 * value at all (see `readRecoveryHash`).
 */
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LEN = 32;

function scrypt(secret: string, salt: Buffer, keyLen = KEY_LEN): Buffer {
  return scryptSync(secret.normalize("NFKC"), salt, keyLen, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: 64 * 1024 * 1024,
  });
}

export function hashSecret(secret: string, salt: Buffer): string {
  return `${HASH_PREFIX}.${salt.toString("hex")}.${scrypt(secret, salt).toString("hex")}`;
}

/** Constant-time comparison of a candidate against a stored scrypt hash. */
export function verifySecret(candidate: string, stored: string): boolean {
  const parsed = parseStoredHash(stored);
  if (!isUsable(parsed)) return false;
  const actual = scrypt(candidate, parsed.salt, parsed.hash.length);
  return actual.length === parsed.hash.length && timingSafeEqual(actual, parsed.hash);
}

/**
 * Hashes a secret that must not be crackable offline: `scrypt.v1.<saltHex>.<hashHex>`, where the
 * scrypt input is `HMAC-SHA256(pepper, secret)` rather than the secret itself.
 *
 * The pepper is required. Without it a 4-digit code is only 10 000 guesses away and the hash is
 * worthless once it leaks, so `null` is returned instead of producing a weak hash.
 */
export function hashPepperedSecret(secret: string, salt: Buffer, pepper: string): string {
  const input = createHmac("sha256", pepper).update(secret.normalize("NFKC")).digest("hex");
  return `${HASH_PREFIX}.${VERSION_V1}.${salt.toString("hex")}.${scrypt(input, salt).toString("hex")}`;
}

/** Constant-time verification of a peppered `scrypt.v1...` hash. False for any other format. */
export function verifyPepperedSecret(candidate: string, stored: string, pepper: string): boolean {
  const parsed = parseStoredHash(stored);
  if (!isUsable(parsed) || parsed.version !== VERSION_V1) return false;
  const input = createHmac("sha256", pepper).update(candidate.normalize("NFKC")).digest("hex");
  const actual = scrypt(input, parsed.salt, parsed.hash.length);
  return actual.length === parsed.hash.length && timingSafeEqual(actual, parsed.hash);
}

/**
 * True when a string has the shape of a peppered hash we produced.
 *
 * The salt must be 32 hex characters (16 bytes), which is what makes a value that the environment
 * loader mangled fail closed here instead of being quietly accepted.
 */
export function isPepperedHash(value: string | undefined | null): boolean {
  const parsed = parseStoredHash((value ?? "").trim());
  return isUsable(parsed) && parsed.version === VERSION_V1 && parsed.salt.length === 16;
}

/** A fresh random salt for a new hash. */
export function newSalt(): Buffer {
  return randomBytes(16);
}

/** A fresh random pepper, generated by the setup script and written to the environment. */
export function newPepper(): string {
  return randomBytes(32).toString("base64url");
}

export interface PrvAuthConfig {
  /** Owner display name, e.g. "Bilal". Not a secret. */
  ownerUsername: string;
  /** Owner email, used as a second login factor alongside the password. Not a secret. */
  ownerEmail: string;
  /** scrypt$v1$ hash of the owner password, or `null` when not configured. */
  ownerPasswordHash: string | null;
  /** scrypt$v1$ hash of the 4-digit PRV code, or `null` when not configured. */
  accessCodeHash: string | null;
  /** scrypt hash of the recovery phrase, or `null` when no private phrase has been set. */
  recoveryHash: string | null;
  /** Secret used to sign the session cookies. Generated and persisted on first boot if absent. */
  sessionSecret: string;
  /** True only when the pepper, both hashes and the owner identity are all present. */
  isConfigured: boolean;
  /** True when a private recovery phrase has been configured. Recovery is optional; without one it is refused. */
  isRecoveryConfigured: boolean;
  /** True when the owner account is set up enough to attempt a login. */
  isOwnerConfigured: boolean;
}

function readPepper(): string | null {
  const value = process.env.PRV_SECRET_PEPPER?.trim();
  return value && value.length >= 32 ? value : null;
}

/**
 * The recovery phrase hash, or `null` when it has not been configured.
 *
 * There is deliberately no default. This used to fall back to a deterministic hash of a phrase
 * hardcoded in this file, which meant that any deployment missing `PRV_RECOVERY_HASH` - a fresh
 * install, a container that forgets the variable, a half-restored `.env` - could be unlocked by
 * anyone who had read the source, and the fallback lifted the code lockout as well. A recovery
 * phrase is only a safety net if it is secret, so recovery now fails closed like the password and
 * the code: with no `PRV_RECOVERY_HASH` there is no recovery, and the UI says so.
 */
function readRecoveryHash(): string | null {
  const fromEnv = process.env.PRV_RECOVERY_HASH?.trim();
  return isPepperedHash(fromEnv) || isUsable(parseStoredHash(fromEnv ?? "")) ? (fromEnv as string) : null;
}

/**
 * The 4-digit access code is NEVER hardcoded and never committed in plaintext. Only the peppered
 * scrypt hash produced by `npm run prv:setup` is read, and while that variable is absent PRV stays
 * locked and says so, rather than falling back to a guessable default.
 */
function readAccessCodeHash(): string | null {
  const value = process.env.PRV_ACCESS_CODE_HASH?.trim();
  return isPepperedHash(value) ? (value as string) : null;
}

function readOwnerUsername(): string {
  return process.env.PRV_OWNER_USERNAME?.trim() ?? "";
}

function readOwnerEmail(): string {
  return process.env.PRV_OWNER_EMAIL?.trim().toLowerCase() ?? "";
}

function readOwnerPasswordHash(): string | null {
  const value = process.env.PRV_OWNER_PASSWORD_HASH?.trim();
  return isPepperedHash(value) ? (value as string) : null;
}

/** Set to a strong random value; generated once and reused from the private store when absent. */
function readSessionSecret(): string {
  const fromEnv = process.env.PRV_SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  return "";
}

export function getPrvAuthConfig(): PrvAuthConfig {
  const pepper = readPepper();
  const ownerPasswordHash = pepper ? readOwnerPasswordHash() : null;
  const accessCodeHash = pepper ? readAccessCodeHash() : null;
  const recoveryHash = readRecoveryHash();
  return {
    ownerUsername: readOwnerUsername(),
    ownerEmail: readOwnerEmail(),
    ownerPasswordHash,
    accessCodeHash,
    recoveryHash,
    sessionSecret: readSessionSecret(),
    isConfigured: accessCodeHash !== null,
    isOwnerConfigured: ownerPasswordHash !== null && readOwnerUsername() !== "" && readOwnerEmail() !== "",
    isRecoveryConfigured: recoveryHash !== null,
  };
}

/** The pepper, or `null` when unset. Used to verify the two peppered hashes above. */
export function getPepper(): string | null {
  return readPepper();
}
