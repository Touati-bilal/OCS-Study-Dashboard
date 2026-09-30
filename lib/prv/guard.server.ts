/**
 * Server-side gate for every PRV API route.
 *
 * Each route calls `requirePrvSession` first and returns its 401 immediately when it fails, so an
 * unauthorised request never reaches any PRV business logic. This is the single place that
 * decides access, which is what keeps a new route from accidentally shipping unprotected.
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
 * Uniform 401 body. It never says whether a session existed, only that it did not - so it cannot be
 * used to probe which cookies a caller holds. The wording is configurable because this is now also
 * the gate on the study-file APIs, which are not PRV.
 */
export function unauthorized(message = "Accès PRV refusé."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/** The 401 used by the study-file routes: same shape, no PRV wording. */
export function unauthorizedFiles(): NextResponse {
  return unauthorized("Connectez-vous pour gérer vos fichiers.");
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
 * This is the gate for the study-file APIs (`/api/uploads`, `/api/module-files`). They used to have
 * no authorisation at all, which let anyone who could reach the app list, read, overwrite and
 * delete the owner's files, and - because `moduleId` was joined into a path unchecked - write
 * anywhere on the filesystem. The owner account is the authorisation this app already has, so
 * requiring it is the smallest change that closes the hole; the 4-digit code stays the extra gate
 * for PRV's own private data, which is what the user is more protective of.
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
