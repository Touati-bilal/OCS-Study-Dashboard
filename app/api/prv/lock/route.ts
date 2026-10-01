/**
 * POST /api/prv/lock — ends the PRV session immediately.
 *
 * Used by the "Verrouiller" control and when locking the phone. Clearing the cookie is what makes
 * the PRV pages redirect again, so the next visit needs the code.
 *
 * Locking also bumps the PRV-only epoch, so a copy of the cookie captured earlier stops working
 * instead of staying valid for the rest of its 12 hours. The owner account stays signed in: locking
 * the private area should cost the 4-digit code again, not a full re-login.
 */
import { NextResponse } from "next/server";

import { PRV_COOKIE, rotatePrvEpoch } from "@/lib/prv/auth.server";
import { isSameOrigin, sessionCookieOptions } from "@/lib/prv/guard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }
  await rotatePrvEpoch();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PRV_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
