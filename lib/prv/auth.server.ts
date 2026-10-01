/**
 * PRV authentication: 4-digit access code, temporary lockout, recovery, and a signed session.
 *
 * All of this runs server-side. The browser never receives the access code, the recovery phrase,
 * their hashes, or the session secret - only an opaque, signed, httpOnly cookie.
 *
 * Failure responses are deliberately uniform: a wrong code, an unknown state and a locked PRV
 * all answer with the same generic message, so the API never reveals whether a given digit was
 * correct, nor how many attempts remain.
 */
import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  getPrvAuthConfig,
  LOCKOUT_DURATION_MS,
  LOGIN_LOCKOUT_MS,
  MAX_ACCESS_ATTEMPTS,
  MAX_LOGIN_ATTEMPTS,
  MAX_RECOVERY_ATTEMPTS,
  RECOVERY_LOCKOUT_MS,
  getPepper,
  isPepperedHash,
  verifyPepperedSecret,
  verifySecret,
} from "./config.server";
import { newOpaqueId, readSingleton, updateCollection, writeSingleton } from "./store.server";

export const PRV_COOKIE = "prv_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/** The single message every rejection returns, whatever the real cause. */
export const GENERIC_DENIED = "Accès PRV refusé.";

export interface AuthState {
  /** Secret used to sign cookies; generated on first use and stored server-side. */
  sessionSecret: string;
  /**
   * Cutoff, as a millisecond timestamp. A token whose `iat` is older is refused, so signing out
   * genuinely ends the session instead of only asking the browser to drop the cookie: a copy of
   * the cookie captured earlier stops working. Zero means "no cutoff yet".
   */
  epoch: number;
  /**
   * Same idea as `epoch`, but for the 4-digit code alone. "Verrouiller" bumps this so a copy of the
   * PRV cookie captured earlier stops working, while the owner account stays signed in: locking the
   * private area should cost the code again, not a full re-login.
   */
  prvEpoch: number;
  failedAccessAttempts: number;
  lockedUntil: number | null;
  failedRecoveryAttempts: number;
  recoveryLockedUntil: number | null;
  failedLoginAttempts: number;
  loginLockedUntil: number | null;
}

function emptyAuthState(): AuthState {
  return {
    sessionSecret: "",
    epoch: 0,
    prvEpoch: 0,
    failedAccessAttempts: 0,
    lockedUntil: null,
    failedRecoveryAttempts: 0,
    recoveryLockedUntil: null,
    failedLoginAttempts: 0,
    loginLockedUntil: null,
  };
}

export function loadAuthState(): AuthState {
  return { ...emptyAuthState(), ...readSingleton<AuthState>("auth-state", emptyAuthState()) };
}

/** Environment secret wins; otherwise the generated one is persisted so sessions survive restarts. */
export async function getSessionSecret(): Promise<string> {
  const fromEnv = getPrvAuthConfig().sessionSecret;
  if (fromEnv) return fromEnv;
  const state = loadAuthState();
  if (state.sessionSecret) return state.sessionSecret;
  const generated = randomBytes(32).toString("base64url");
  const next = await updateCollection<AuthState>("auth-state", (items) => {
    const current = items.length > 0 ? items[0] : emptyAuthState();
    return [{ ...current, sessionSecret: current.sessionSecret || generated }];
  });
  return next[0].sessionSecret;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

export interface PrvSession {
  /** Issued-at and expiry, in epoch milliseconds. */
  iat: number;
  exp: number;
  /** Random id, so two sessions issued in the same millisecond are still distinct. */
  jti: string;
  /**
   * Audience. "prv" opens the private area, "owner" is the account login. Verification requires a
   * matching scope, so a stolen or replayed owner cookie cannot be presented as a PRV one.
   */
  aud: string;
}

export const PRV_SESSION_SCOPE = "prv";

/** Creates a signed session payload `base64url(payload).base64url(signature)` for one audience. */
export async function createScopedSessionToken(aud: string, ttlMs = SESSION_TTL_MS): Promise<string> {
  const secret = await getSessionSecret();
  const now = Date.now();
  const session: PrvSession = { iat: now, exp: now + ttlMs, jti: newOpaqueId(12), aud };
  const payload = base64url(Buffer.from(JSON.stringify(session), "utf8"));
  return `${payload}.${sign(payload, secret)}`;
}

/** The PRV-area session, i.e. the one the 4-digit code grants. */
export async function createSessionToken(ttlMs = SESSION_TTL_MS): Promise<string> {
  return createScopedSessionToken(PRV_SESSION_SCOPE, ttlMs);
}

/**
 * Verifies a token's signature and expiry. Returns `null` for anything malformed, tampered with,
 * or expired - never throws and never explains why.
 */
export async function verifyScopedSessionToken(
  token: string | undefined | null,
  audience: string
): Promise<PrvSession | null> {
  const session = await verifySessionToken(token);
  if (session === null) return null;
  // A token minted for one audience is worthless for the other.
  if (session.aud !== audience) return null;
  // "Verrouiller" invalidates the code session without touching the owner account.
  if (audience === PRV_SESSION_SCOPE && typeof session.iat === "number" && session.iat < loadAuthState().prvEpoch) {
    return null;
  }
  return session;
}

export async function verifySessionToken(token: string | undefined | null): Promise<PrvSession | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const secret = await getSessionSecret();
  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PrvSession;
    if (typeof session.exp !== "number" || session.exp < Date.now()) return null;
    // A signature alone is not enough: a token minted before the last sign-out is dead.
    if (typeof session.iat !== "number" || session.iat < loadAuthState().epoch) return null;
    return session;
  } catch {
    return null;
  }
}

export function isAuthLocked(until: number | null): boolean {
  return typeof until === "number" && until > Date.now();
}

const isLocked = isAuthLocked;

/**
 * Counts one failed owner login and locks the account once the budget is spent. Returns whether the
 * failure triggered the lock. The counter is persisted, so a restart cannot reset the budget.
 */
export async function recordLoginFailure(): Promise<boolean> {
  const state = loadAuthState();
  const failed = state.failedLoginAttempts + 1;
  const shouldLock = failed >= MAX_LOGIN_ATTEMPTS;
  await updateCollection<AuthState>("auth-state", (items) => {
    const current = items[0] ?? emptyAuthState();
    return [
      {
        ...current,
        failedLoginAttempts: shouldLock ? 0 : failed,
        loginLockedUntil: shouldLock ? Date.now() + LOGIN_LOCKOUT_MS : current.loginLockedUntil,
      },
    ];
  });
  return shouldLock;
}

/** Clears the login attempt budget after a successful authentication. */
export async function clearLoginFailures(): Promise<void> {
  await updateCollection<AuthState>("auth-state", (items) => {
    const current = items[0] ?? emptyAuthState();
    return [
      { ...current, failedLoginAttempts: 0, loginLockedUntil: null, sessionSecret: current.sessionSecret },
    ];
  });
}

export type UnlockOutcome = "ok" | "locked" | "not_configured" | "denied";

/**
 * Verifies the 4-digit access code and, on success, returns a session token.
 *
 * Three consecutive failures lock PRV for a limited time. The lock is temporary and the recovery
 * phrase is the way back in, so a mistake never locks the owner out permanently.
 */
export async function unlockWithAccessCode(code: string): Promise<{ outcome: UnlockOutcome; token?: string }> {
  const config = getPrvAuthConfig();

  if (!config.accessCodeHash) return { outcome: "not_configured" };

  const state = loadAuthState();
  if (isLocked(state.lockedUntil)) return { outcome: "locked" };

  // A malformed value still costs an attempt, so probing cannot be cheaper than guessing.
  const looksValid = /^\d{4}$/.test(code);
  // The stored hash is peppered, so it must be verified with the peppered verifier. Using the plain
  // one here compares a peppered hash against an unpeppered derivation and can never match, which
  // locks the owner out of their own PRV.
  const pepper = getPepper();
  const correct = looksValid && pepper !== null && verifyPepperedSecret(code, config.accessCodeHash, pepper);

  if (correct) {
    await updateCollection<AuthState>("auth-state", (items) => [
      { ...(items[0] ?? emptyAuthState()), sessionSecret: items[0]?.sessionSecret ?? "", failedAccessAttempts: 0, lockedUntil: null },
    ]);
    return { outcome: "ok", token: await createSessionToken() };
  }

  const failed = state.failedAccessAttempts + 1;
  const shouldLock = failed >= MAX_ACCESS_ATTEMPTS;
  await updateCollection<AuthState>("auth-state", (items) => {
    const current = items[0] ?? emptyAuthState();
    return [
      {
        ...current,
        failedAccessAttempts: shouldLock ? 0 : failed,
        lockedUntil: shouldLock ? Date.now() + LOCKOUT_DURATION_MS : current.lockedUntil,
      },
    ];
  });
  return { outcome: shouldLock ? "locked" : "denied" };
}

/** `unconfigured` means no private phrase is set, so recovery is refused rather than guessed. */
export type RecoveryOutcome = "ok" | "locked" | "denied" | "unconfigured";

/**
 * Recovers access with the recovery phrase and clears any active lockout.
 *
 * The phrase is never accepted as an alternative access code: it is checked against its own
 * hash, behind its own attempt budget, and it is the only way to lift a lockout.
 */
export async function recoverWithPhrase(phrase: string): Promise<{ outcome: RecoveryOutcome; token?: string }> {
  const config = getPrvAuthConfig();
  const state = loadAuthState();

  if (!config.accessCodeHash) return { outcome: "denied" };
  // No private phrase has been configured, so there is nothing to compare against. Refusing here
  // is the point: with the old fallback, any deployment missing `PRV_RECOVERY_HASH` accepted a
  // phrase that was written in the source.
  if (!config.recoveryHash) return { outcome: "unconfigured" };
  if (isLocked(state.recoveryLockedUntil)) return { outcome: "locked" };

  // `PRV_RECOVERY_HASH` is written by `npm run prv:setup` and is peppered like the other two
  // credentials, so only the peppered format is accepted.
  const candidate = phrase.trim();
  const pepper = getPepper();
  const correct =
    candidate.length > 0 &&
    pepper !== null &&
    isPepperedHash(config.recoveryHash) &&
    verifyPepperedSecret(candidate, config.recoveryHash, pepper);

  if (correct) {
    await updateCollection<AuthState>("auth-state", (items) => {
      const current = items[0] ?? emptyAuthState();
      return [
        {
          ...current,
          sessionSecret: current.sessionSecret,
          failedAccessAttempts: 0,
          lockedUntil: null,
          failedRecoveryAttempts: 0,
          recoveryLockedUntil: null,
        },
      ];
    });
    return { outcome: "ok", token: await createSessionToken() };
  }

  const failed = state.failedRecoveryAttempts + 1;
  const shouldLock = failed >= MAX_RECOVERY_ATTEMPTS;
  await updateCollection<AuthState>("auth-state", (items) => {
    const current = items[0] ?? emptyAuthState();
    return [
      {
        ...current,
        failedRecoveryAttempts: shouldLock ? 0 : failed,
        recoveryLockedUntil: shouldLock ? Date.now() + RECOVERY_LOCKOUT_MS : current.recoveryLockedUntil,
      },
    ];
  });
  return { outcome: shouldLock ? "locked" : "denied" };
}

export interface SessionStatus {
  authenticated: boolean;
  configured: boolean;
  locked: boolean;
  lockedUntil: number | null;
}

export function getSessionStatus(session: PrvSession | null): SessionStatus {
  const state = loadAuthState();
  return {
    authenticated: session !== null,
    configured: getPrvAuthConfig().accessCodeHash !== null,
    locked: isLocked(state.lockedUntil),
    lockedUntil: isLocked(state.lockedUntil) ? state.lockedUntil : null,
  };
}

/**
 * Invalidates every session issued so far, by moving the cutoff past their `iat`. Used on sign-out.
 *
 * The cutoff is a timestamp rather than a counter because it is compared against a token's `iat`,
 * which is also a timestamp. `Date.now()` alone would be off by a millisecond or two against a
 * token minted in the same instant, so the later of the two wins.
 */
export async function rotateSessionEpoch(): Promise<void> {
  const now = Date.now();
  await updateCollection<AuthState>("auth-state", (items) => {
    const current = items[0] ?? emptyAuthState();
    return [
      {
        ...current,
        epoch: Math.max(now, (current.epoch ?? 0) + 1),
        prvEpoch: Math.max(now, (current.prvEpoch ?? 0) + 1),
        sessionSecret: current.sessionSecret,
      },
    ];
  });
}

/**
 * Invalidates every session issued for the 4-digit code, leaving the owner account signed in.
 *
 * Without this, "Verrouiller" only asked the browser to drop the cookie: a copy of it captured
 * earlier kept working until it expired on its own.
 */
export async function rotatePrvEpoch(): Promise<void> {
  const now = Date.now();
  await updateCollection<AuthState>("auth-state", (items) => {
    const current = items[0] ?? emptyAuthState();
    return [
      {
        ...current,
        prvEpoch: Math.max(now, (current.prvEpoch ?? 0) + 1),
        sessionSecret: current.sessionSecret,
      },
    ];
  });
}

/** Test-only reset of the attempt counters; never exposed through a route. */
export async function __resetAuthStateForTests(): Promise<void> {
  await writeSingleton("auth-state", emptyAuthState());
}
