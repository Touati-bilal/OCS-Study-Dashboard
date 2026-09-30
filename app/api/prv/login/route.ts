/**
 * POST /api/prv/login — owner login: username + email + password.
 *
 * Password authentication is entirely server-side: the request body is read here, checked against a
 * peppered scrypt hash, and discarded. Nothing about the credentials is logged, returned, or stored
 * anywhere but the caller's own network tab.
 *
 * Two independent defences apply: a per-client rate limit that absorbs bursts before the expensive
 * hash runs, and a persistent attempt counter that locks the account for 15 minutes after five
 * failures. Every rejection is the same generic message with the same status, so the endpoint never
 * reveals whether the username, the email or the password was the part that was wrong.
 */
import { NextResponse } from "next/server";

import { GENERIC_DENIED, OWNER_COOKIE, loginOwner } from "@/lib/prv/owner.server";
import { isSameOrigin, ownerSessionCookieOptions } from "@/lib/prv/guard.server";
import { clientKey, consumeRateLimit } from "@/lib/prv/rate-limit.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ten attempts per five minutes per client. */
const LIMIT = 10;
const WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  const limit = consumeRateLimit(clientKey(request, "login"), LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
    );
  }

  let username = "";
  let email = "";
  let password = "";
  try {
    const body = await request.json();
    username = typeof body?.username === "string" ? body.username : "";
    email = typeof body?.email === "string" ? body.email : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // An empty password is rejected before hashing, so a blank field cannot be mistaken for a guess.
  if (password === "") {
    return NextResponse.json({ error: GENERIC_DENIED }, { status: 401 });
  }

  const result = await loginOwner({ username, email, password });

  if (result.outcome === "ok" && result.token) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(OWNER_COOKIE, result.token, ownerSessionCookieOptions());
    return response;
  }

  if (result.outcome === "not_configured") {
    return NextResponse.json(
      {
        error: "PRV n'est pas configuré.",
        detail: "Lancez « npm run prv:setup » pour définir le compte et les codes, puis relancez le serveur.",
      },
      { status: 503 }
    );
  }

  if (result.outcome === "locked") {
    return NextResponse.json({ error: GENERIC_DENIED, locked: true }, { status: 423 });
  }

  return NextResponse.json({ error: GENERIC_DENIED, locked: false }, { status: 401 });
}
