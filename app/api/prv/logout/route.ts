/**
 * POST /api/prv/logout — ends the owner session and, optionally, the PRV session.
 *
 * Signing out of the account must not leave the private area open, so the PRV cookie is cleared too.
 */
import { NextResponse } from "next/server";

import { PRV_COOKIE, rotateSessionEpoch } from "@/lib/prv/auth.server";
import { OWNER_COOKIE, logoutOwner } from "@/lib/prv/owner.server";
import { isSameOrigin, sessionCookieOptions, ownerSessionCookieOptions } from "@/lib/prv/guard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }
  // Ending a session is always safe to do, whether or not a valid one existed.
  const result = await logoutOwner(request);
  // Signing out must actually end the session, not merely ask the browser to drop the cookie: the
  // epoch bump makes any copy of either cookie that was captured earlier useless from now on.
  if (result === "ok") await rotateSessionEpoch();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OWNER_COOKIE, "", { ...ownerSessionCookieOptions(), maxAge: 0 });
  response.cookies.set(PRV_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
