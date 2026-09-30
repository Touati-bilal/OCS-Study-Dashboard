/**
 * Generates the environment for the PRV test server.
 *
 * The suites need a real owner account and a real 4-digit code, and they must exercise the same
 * hash-based path the owner uses. So this prints shell `export` lines that contain *only* peppered
 * hashes: the plaintext password and code exist here, in this throwaway process, purely so the test
 * client can submit them over HTTP exactly as a browser would.
 *
 * These values are test fixtures for a throwaway server bound to localhost, and they are never
 * written to disk or committed. They are not demo credentials: nothing in the app ships them.
 */
import { createHmac, randomBytes, scryptSync } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function hashPeppered(secret: string, pepper: string): string {
  const salt = randomBytes(16);
  const input = createHmac("sha256", pepper).update(secret.normalize("NFKC")).digest("hex");
  const hash = scryptSync(input, salt, 32, SCRYPT);
  return `scrypt.v1.${salt.toString("hex")}.${hash.toString("hex")}`;
}

const pepper = randomBytes(32).toString("base64url");
const sessionSecret = randomBytes(32).toString("base64url");
const username = "Test Owner";
const email = "prv-test-owner@example.invalid";
const password = randomBytes(24).toString("base64url");
const code = String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, "0");

const lines: Array<[string, string]> = [
  ["PRV_SECRET_PEPPER", pepper],
  ["PRV_SESSION_SECRET", sessionSecret],
  ["PRV_OWNER_USERNAME", username],
  ["PRV_OWNER_EMAIL", email],
  ["PRV_OWNER_PASSWORD_HASH", hashPeppered(password, pepper)],
  ["PRV_ACCESS_CODE_HASH", hashPeppered(code, pepper)],
  // The recovery phrase the suites use. This has to be set explicitly: `next start` reads
  // `.env.local`, and any PRV_ value present there would otherwise leak into the run and the
  // developer's own recovery phrase would be tested instead of the fixture's.
  ["PRV_RECOVERY_HASH", hashPeppered("Mimi", pepper)],
  // Consumed by the test clients so they can submit the same credentials a browser would.
  ["PRV_TEST_USERNAME", username],
  ["PRV_TEST_EMAIL", email],
  ["PRV_TEST_PASSWORD", password],
  ["PRV_TEST_CODE", code],
  // Neutralisers, so a developer's local configuration cannot influence a test run. An empty string
  // counts as "already set" to the environment loader, which is what stops `.env.local` winning.
  ["PRV_TRUST_PROXY", ""],
  ["PRV_OBSIDIAN_VAULT", ""],
  ["PUSH_PUBLIC_KEY", ""],
  ["PUSH_PRIVATE_KEY", ""],
  ["PUSH_SUBJECT", ""],
];

for (const [key, value] of lines) {
  // Single-quoted, and emphatically not double: a hash contains `scrypt$v1$...`, which a double-quoted
  // shell string would try to expand as `$v1`. Inside single quotes nothing is reinterpreted.
  const safe = value.replace(/'/g, `'\\''`);
  console.log(`export ${key}='${safe}'`);
}
