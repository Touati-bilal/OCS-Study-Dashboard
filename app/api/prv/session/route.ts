/**
 * GET /api/prv/session — which of the two gates, if any, are open.
 *
 * `stage` is the single field the UI needs: "signed-out", "owner" or "prv". It never says anything
 * about a credential, and the two cookies are checked with different audiences so neither can stand
 * in for the other.
 */
import { NextResponse } from "next/server";

import { getSessionStatus } from "@/lib/prv/auth.server";
import { ownerSessionStatus } from "@/lib/prv/owner.server";
import { getOwnerSessionFromRequest, getSessionFromRequest } from "@/lib/prv/guard.server";
import { isAiConfigured } from "@/lib/prv/ai.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = await getOwnerSessionFromRequest(request);
  const prv = await getSessionFromRequest(request);

  const ownerState = ownerSessionStatus(owner);
  const prvState = getSessionStatus(prv);

  return NextResponse.json(
    {
      stage: prv ? "prv" : owner ? "owner" : "signed-out",
      ownerAuthenticated: ownerState.authenticated,
      ownerConfigured: ownerState.configured,
      authenticated: prvState.authenticated,
      configured: prvState.configured && ownerState.configured,
      locked: prvState.locked,
      lockedUntil: prvState.lockedUntil,
      aiConfigured: isAiConfigured(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
