/**
 * Authorisation for the study-file APIs: `/api/uploads` and `/api/module-files`.
 *
 * These two routes belong to the OCS module pages (Documents → Fichiers / Proger / TP, and the
 * TP & Projects tab shared with OCC and ORS). They read and write the owner's documents on the
 * server, so every method requires a signed-in account — without it anyone who could reach the app
 * could list, download, overwrite and delete those files.
 *
 * They are deliberately *not* gated on the 4-digit PRV code: PRV's own private data is a different
 * thing, protected separately, and none of it lives behind these routes. Keeping the check here,
 * outside the PRV tree, is what lets the module pages stay free of any PRV surface while their
 * uploads remain owner-only.
 *
 * The verification itself is not reimplemented: it is the same signed, audience-scoped, expiring
 * token check the account login issues, so there is exactly one implementation of it in the
 * codebase. What this module adds is the neutral name these routes depend on, and a 401 that
 * carries no wording belonging to any other area of the app.
 */
import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyScopedSessionToken } from "./prv/auth.server";
import { OWNER_COOKIE, OWNER_SESSION_SCOPE } from "./prv/owner.server";

/**
 * Uniform 401 for these two routes.
 *
 * It never says whether a session existed, only that one did not, so it cannot be used to probe
 * which cookies a caller holds — and it carries no wording belonging to any other area of the app.
 */
export function unauthorizedFiles(): NextResponse {
  return NextResponse.json({ error: "Connectez-vous pour gérer vos fichiers." }, { status: 401 });
}

/** The signed-in account session, read from the request header or the server-side store. */
export async function getOwnerSession(request: Request): Promise<boolean> {
  const fromHeader = request.headers.get("cookie") ?? "";
  const fromStore = (await cookies()).get(OWNER_COOKIE)?.value;
  const raw = fromHeader || fromStore;
  if (!raw) return false;

  // Accept the first matching cookie; duplicates are not trusted over the first valid one.
  const match = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OWNER_COOKIE}=`));

  return (await verifyScopedSessionToken(match ? match.slice(OWNER_COOKIE.length + 1) : undefined, OWNER_SESSION_SCOPE)) !== null;
}

/**
 * The single check both study-file routes call.
 *
 * Note this is the *account* session only. The 4-digit code is an extra gate in front of PRV's own
 * data and has no business here, where there is no private data to reach.
 */
export async function requireOwnerAccess(request: Request): Promise<boolean> {
  return getOwnerSession(request);
}