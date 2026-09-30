/**
 * POST /api/prv/recover — unlocks PRV with the recovery phrase.
 *
 * The phrase is checked against its own hash behind its own attempt budget, and it is the only way
 * to lift an access-code lockout. It is never accepted as an access code, never stored in the
 * clear, and never echoed back.
 */
import { NextResponse } from "next/server";

import { GENERIC_DENIED, recoverWithPhrase } from "@/lib/prv/auth.server";
import { getPrvAuthConfig } from "@/lib/prv/config.server";
import { isSameOrigin, sessionCookieOptions, PRV_COOKIE, getOwnerSessionFromRequest } from "@/lib/prv/guard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  // The phrase unlocks the *code* stage, so the account must already be signed in. It is a way back
  // in after too many code guesses - never a way around the first gate.
  if ((await getOwnerSessionFromRequest(request)) === null) {
    return NextResponse.json({ error: "Connectez-vous d'abord." }, { status: 401 });
  }

  let phrase = "";
  try {
    const body = await request.json();
    phrase = typeof body?.phrase === "string" ? body.phrase.trim() : "";
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // Recovery exists only because the owner set a private phrase. With none configured the endpoint
  // says so and stops, instead of falling back to a value that used to be in the source.
  if (!getPrvAuthConfig().isRecoveryConfigured) {
    return NextResponse.json(
      { error: "Aucune phrase de récupération n'est configurée. Reconnectez-vous avec votre mot de passe." },
      { status: 501 }
    );
  }

  if (phrase.length === 0 || phrase.length > 200) {
    return NextResponse.json({ error: GENERIC_DENIED }, { status: 401 });
  }

  const result = await recoverWithPhrase(phrase);

  if (result.outcome === "ok" && result.token) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(PRV_COOKIE, result.token, sessionCookieOptions());
    return response;
  }

  if (result.outcome === "locked") {
    return NextResponse.json({ error: GENERIC_DENIED, locked: true }, { status: 423 });
  }

  return NextResponse.json({ error: GENERIC_DENIED, locked: false }, { status: 401 });
}
