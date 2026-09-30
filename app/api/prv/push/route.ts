/**
 * GET  /api/prv/push — is push available, and how many devices are registered.
 * POST /api/prv/push — register this device.
 * DELETE /api/prv/push — unregister this device.
 *
 * The VAPID public key is safe to expose; the private key never leaves the server.
 */
import { NextResponse } from "next/server";

import { requirePrvAccess, isSameOrigin, unauthorized } from "@/lib/prv/guard.server";
import { addSubscription, getPublicKey, isPushConfigured, removeSubscription } from "@/lib/prv/push.server";
import { readCollection } from "@/lib/prv/store.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  return NextResponse.json(
    {
      configured: isPushConfigured(),
      publicKey: getPublicKey(),
      devices: readCollection("push-subscriptions").length,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Notifications push non configurées (PUSH_PUBLIC_KEY / PUSH_PRIVATE_KEY)." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const endpoint = typeof raw.endpoint === "string" ? raw.endpoint.trim() : "";
  const keys = (raw.keys ?? {}) as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";

  if (!endpoint.startsWith("https://") || p256dh.length === 0 || auth.length === 0) {
    return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
  }

  await addSubscription({
    endpoint,
    p256dh,
    auth,
    userAgent: request.headers.get("user-agent") ?? "",
  });
  return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  let endpoint = "";
  try {
    const body = await request.json();
    endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (endpoint.length === 0) return NextResponse.json({ error: "Endpoint requis." }, { status: 400 });

  await removeSubscription(endpoint);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
