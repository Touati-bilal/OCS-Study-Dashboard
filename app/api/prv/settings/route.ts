/**
 * GET  /api/prv/settings — the PRV thresholds currently in force.
 * POST /api/prv/settings — update them.
 *
 * Values are clamped by `sanitizeSettings`, so an out-of-range weight or day is rejected rather
 * than stored. These settings drive the deterministic report, which is why they live on the
 * server: a cron-generated report must use the same numbers as the screen.
 */
import { NextResponse } from "next/server";

import { requirePrvAccess, isSameOrigin, unauthorized } from "@/lib/prv/guard.server";
import { getSettings, saveSettings } from "@/lib/prv/settings.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  return NextResponse.json(getSettings(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const settings = await saveSettings(body);
  return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
}
