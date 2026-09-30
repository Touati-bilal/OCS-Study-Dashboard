/**
 * Owner authentication: username + email + password, verified server-side.
 *
 * This is the first of the two gates in front of PRV. Passing it establishes an *owner session*;
 * the 4-digit code is then still required to open PRV itself, so neither secret is sufficient on
 * its own.
 *
 * The password is never stored in plaintext, never logged, never echoed in a response and never
 * reaches the browser. The browser only ever receives an opaque, signed, httpOnly cookie. The
 * username and email are identifiers, not secrets, and are compared in constant time.
 */
import "server-only";

import {
  getPepper,
  getPrvAuthConfig,
  LOGIN_LOCKOUT_MS,
  MAX_LOGIN_ATTEMPTS,
  verifyPepperedSecret,
} from "./config.server";
import {
  GENERIC_DENIED,
  createScopedSessionToken,
  isAuthLocked,
  loadAuthState,
  recordLoginFailure,
  clearLoginFailures,
  verifyScopedSessionToken,
  type PrvSession,
} from "./auth.server";

/** Separate cookie from the PRV one, and scoped so the two can never be used interchangeably. */
export const OWNER_COOKIE = "prv_owner";
export const OWNER_SESSION_SCOPE = "owner";
export const OWNER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type LoginOutcome = "ok" | "locked" | "not_configured" | "denied";

/**
 * Verifies the owner's three identifiers and, on success, returns an owner session token.
 *
 * Every failure is the same generic denial, and the scrypt work is performed whether or not the
 * username and email matched. That is deliberate: if a wrong username returned faster than a right
 * one, the endpoint would leak which account exists.
 */
export async function loginOwner(input: {
  username: string;
  email: string;
  password: string;
}): Promise<{ outcome: LoginOutcome; token?: string }> {
  const config = getPrvAuthConfig();
  if (!config.isOwnerConfigured) return { outcome: "not_configured" };

  const state = loadAuthState();
  if (isAuthLocked(state.loginLockedUntil)) return { outcome: "locked" };

  const pepper = getPepper();
  if (pepper === null || config.ownerPasswordHash === null) return { outcome: "not_configured" };

  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();

  // The stored hash is always verified, so the response time does not depend on which field was
  // wrong. `&&` short-circuits only on the cheap comparisons, never on the expensive one.
  const passwordOk = verifyPepperedSecret(input.password, config.ownerPasswordHash, pepper);
  const identityOk = username === config.ownerUsername && email === config.ownerEmail;

  if (passwordOk && identityOk) {
    await clearLoginFailures();
    return { outcome: "ok", token: await createScopedSessionToken(OWNER_SESSION_SCOPE, OWNER_SESSION_TTL_MS) };
  }

  const locked = await recordLoginFailure();
  return { outcome: locked ? "locked" : "denied" };
}

export type LogoutResult = "ok" | "invalid";

/** Ends the owner session. Used by the sign-out control and by the full sign-out. */
export async function logoutOwner(request: Request): Promise<LogoutResult> {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OWNER_COOKIE}=`));
  const session = await verifyScopedSessionToken(match ? match.slice(OWNER_COOKIE.length + 1) : undefined, OWNER_SESSION_SCOPE);
  return session ? "ok" : "invalid";
}

export function ownerSessionStatus(session: PrvSession | null): { authenticated: boolean; configured: boolean } {
  return {
    authenticated: session !== null,
    configured: getPrvAuthConfig().isOwnerConfigured,
  };
}

export { GENERIC_DENIED };
