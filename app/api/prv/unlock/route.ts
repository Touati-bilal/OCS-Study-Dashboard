/**
 * POST /api/prv/unlock — exchanges the 4-digit access code for a PRV session cookie.
 *
 * This is the second gate. The owner account must already be signed in: the code alone never opens
 * the private area, and the owner session alone never does either.
 *
 * The code is verified server-side against a peppered scrypt hash. It is never stored in plaintext,
 * never logged and never echoed back. Three consecutive failures lock PRV for 15 minutes, and the
 * recovery phrase is the way back in.
 *
 * Failure is deliberately indistinguishable: a wrong code, a locked PRV and an unconfigured PRV all
 * return a generic message, and the response never reveals how many attempts remain or whether a
 * particular digit was correct.
 */
import { NextResponse } from "next/server";

import { GENERIC_DENIED, unlockWithAccessCode } from "@/lib/prv/auth.server";
import { isSameOrigin, sessionCookieOptions, PRV_COOKIE, getOwnerSessionFromRequest } from "@/lib/prv/guard.server";
import { clientKey, consumeRateLimit } from "@/lib/prv/rate-limit.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ten attempts per five minutes per client, in front of the three-attempt lockout. */
const LIMIT = 10;
const WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  const limit = consumeRateLimit(clientKey(request, "unlock"), LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

  // The account must be signed in before the code is even considered.
  if ((await getOwnerSessionFromRequest(request)) === null) {
    return NextResponse.json({ error: "Connectez-vous d'abord." }, { status: 401 });
  }

  let code = "";
  try {
    const body = await request.json();
    code = typeof body?.code === "string" ? body.code.trim() : "";
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const result = await unlockWithAccessCode(code);

  if (result.outcome === "ok" && result.token) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(PRV_COOKIE, result.token, sessionCookieOptions());
    return response;
  }

  if (result.outcome === "not_configured") {
    return NextResponse.json(
      {
        error: "PRV n'est pas configuré.",
        detail: "Lancez « npm run prv:setup » pour définir le compte et le code à 4 chiffres, puis relancez le serveur.",
      },
      { status: 503 }
    );
  }

  // 423 signals a temporary lock, so the UI can say when it lifts without revealing any digit.
  if (result.outcome === "locked") {
    return NextResponse.json(
      { error: GENERIC_DENIED, locked: true },
      { status: 423 }
    );
  }

  return NextResponse.json({ error: GENERIC_DENIED, locked: false }, { status: 401 });
}
