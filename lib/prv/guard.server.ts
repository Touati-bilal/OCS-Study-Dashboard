/**
 * Server-side gate for every PRV API route.
 *
 * Each route calls `requirePrvAccess` first and returns its 401 immediately when it fails, so an
 * unauthorised request never reaches any PRV business logic. This is the single place that
 * decides access to PRV, which is what keeps a new PRV route from accidentally shipping
 * unprotected.
 *
 * This file is PRV's own boundary. Routes that are not PRV - the study-file APIs behind the OCS
 * module pages - are gated in `lib/owner-access.server.ts` instead, so nothing outside the `/prv`
 * tree depends on this module.
 */
import "server-only";

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  PRV_COOKIE,
  PRV_SESSION_SCOPE,
  verifyScopedSessionToken,
  type PrvSession,
} from "./auth.server";
import { OWNER_COOKIE, OWNER_SESSION_SCOPE } from "./owner.server";

export { PRV_COOKIE, OWNER_COOKIE };

/**
 * Uniform 401 body for the PRV routes. It never says whether a session existed, only that it did
 * not - so it cannot be used to probe which cookies a caller holds. The study-file routes are not
 * PRV and have their own gate in `lib/owner-access.server.ts`.
 */
export function unauthorized(message = "Accès PRV refusé."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/** Reads a named cookie from the request header, falling back to the server-side store. */
async function readCookie(request: Request, name: string): Promise<string | undefined> {
  const fromHeader = request.headers.get("cookie") ?? "";
  const fromStore = (await cookies()).get(name)?.value;
  const raw = fromHeader || fromStore;
  if (!raw) return undefined;
  // Accept the first matching cookie; duplicates are not trusted over the first valid one.
  const match = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

/** The PRV-area session, i.e. the one the 4-digit code grants. Scoped to `prv`. */
export async function getSessionFromRequest(request: Request): Promise<PrvSession | null> {
  return verifyScopedSessionToken(await readCookie(request, PRV_COOKIE), PRV_SESSION_SCOPE);
}

/** The owner account session, i.e. the one the username + email + password grants. Scoped to `owner`. */
export async function getOwnerSessionFromRequest(request: Request): Promise<PrvSession | null> {
  return verifyScopedSessionToken(await readCookie(request, OWNER_COOKIE), OWNER_SESSION_SCOPE);
}

/** For pages and server components: `true` only when a valid, unexpired session cookie exists. */
export async function hasPrvSession(): Promise<boolean> {
  const token = (await cookies()).get(PRV_COOKIE)?.value;
  return (await verifyScopedSessionToken(token, PRV_SESSION_SCOPE)) !== null;
}

/** For pages and server components: `true` only when the owner account is signed in. */
export async function hasOwnerSession(): Promise<boolean> {
  const token = (await cookies()).get(OWNER_COOKIE)?.value;
  return (await verifyScopedSessionToken(token, OWNER_SESSION_SCOPE)) !== null;
}

/**
 * Both gates at once. PRV is only reachable when the account is signed in *and* the 4-digit code
 * has been entered, so neither secret is ever sufficient on its own.
 */
export async function hasPrvAccess(): Promise<boolean> {
  return (await hasOwnerSession()) && (await hasPrvSession());
}

/**
 * The single check every protected API route calls, and the reason this file is the only place
 * access is decided.
 *
 * Both cookies are required here, exactly as `hasPrvAccess` requires them for pages. Checking only
 * the code cookie would make the account pointless: anyone who obtained just that cookie - or
 * unlocked with the recovery phrase - would reach every private endpoint. Because every route goes
 * through this one function, a new route cannot ship unprotected by accident.
 */
export async function requirePrvAccess(request: Request): Promise<boolean> {
  return (await getSessionFromRequest(request)) !== null && (await getOwnerSessionFromRequest(request)) !== null;
}

/**
 * Requires the signed-in owner account, without requiring the 4-digit PRV code.
 *
 * Used by PRV's own API routes that act on the account rather than on private data - the sign-out
 * endpoint, which must stay reachable when only the account session is open. The study-file routes
 * use `lib/owner-access.server.ts` instead, which keeps this file scoped to PRV.
 */
export async function requireOwnerAccess(request: Request): Promise<boolean> {
  return (await getOwnerSessionFromRequest(request)) !== null;
}

/** Same-origin check for anything that changes state, to blunt cross-site POSTs. */
export async function isSameOrigin(request: Request): Promise<boolean> {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients (curl, the cron route) send no Origin.
  const host = (await headers()).get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** The PRV-area session cookie. */
export function sessionCookieOptions() {
  return cookieOptions(12 * 60 * 60);
}

/** The owner account cookie. */
export function ownerSessionCookieOptions() {
  return cookieOptions(12 * 60 * 60);
}
