/**
 * POST /api/prv/ai/tasks — asks the AI for task suggestions.
 *
 * The AI key stays on the server. The response is a *proposal list* only: the browser shows each
 * suggestion and the owner confirms it into the real task store through the normal task form.
 * Nothing here writes a task, and the route has no code path that could.
 */
import { NextResponse } from "next/server";

import { proposeTasks } from "@/lib/prv/ai.server";
import { requirePrvAccess, isSameOrigin, unauthorized } from "@/lib/prv/guard.server";
import { computeWeeklyMetrics } from "@/lib/prv/metrics";
import { buildAiBrief } from "@/lib/prv/ai.server";
import { getMainModules } from "@/lib/modules";
import { getSettings } from "@/lib/prv/settings.server";
import { sanitizeSnapshot } from "@/lib/prv/snapshot";
import { getLastCompletedWeek, todayIso, toIsoDate } from "@/lib/prv/weekly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  const settings = getSettings();
  if (!settings.aiEnabled) {
    return NextResponse.json(
      { status: "disabled", requiresConfirmation: true, proposals: [], message: "IA désactivée dans les paramètres." },
      { status: 200 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;

  // The brief is built from sanitised real data, so the prompt can only ever contain what the
  // owner actually has in the store - no key, no session, no file contents.
  const snapshot = sanitizeSnapshot(raw.snapshot);
  const week = getLastCompletedWeek(
    toIsoDate(typeof raw.weekEnd === "string" ? raw.weekEnd : null) ?? todayIso(),
    settings.reportDay
  );
  const metrics = computeWeeklyMetrics(snapshot, week);
  const brief = buildAiBrief(metrics, settings);

  const note = typeof raw.note === "string" ? raw.note : "";
  const result = await proposeTasks(brief, {
    note,
    moduleIds: getMainModules("OCS").map((m) => m.id),
    existingTitles: snapshot.tasks.map((task) => task.title),
  });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
