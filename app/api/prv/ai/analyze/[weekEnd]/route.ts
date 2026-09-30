/**
 * POST /api/prv/ai/analyze/[weekEnd] — adds an AI interpretation to a stored report.
 *
 * Only the interpretation is written. The deterministic metrics, the trajectory and the
 * recommendations are never replaced by model output, so a failed or hallucinating call cannot
 * change a single number in the report.
 */
import { NextResponse } from "next/server";

import { analyzeWeek, buildAiBrief } from "@/lib/prv/ai.server";
import { getSessionFromRequest, isSameOrigin, unauthorized } from "@/lib/prv/guard.server";
import { attachAi, findReportByWeek } from "@/lib/prv/reports.server";
import { getSettings } from "@/lib/prv/settings.server";
import { toIsoDate } from "@/lib/prv/weekly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { weekEnd: string } }) {
  if (!(await getSessionFromRequest(request))) return unauthorized();
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  const settings = getSettings();
  if (!settings.aiEnabled) {
    return NextResponse.json({ status: "disabled", interpretation: [], focus: [] });
  }

  const weekEnd = toIsoDate(params.weekEnd);
  if (!weekEnd) return NextResponse.json({ error: "Semaine invalide." }, { status: 400 });

  const report = findReportByWeek(weekEnd);
  if (!report) return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });

  const analysis = await analyzeWeek(buildAiBrief(report.metrics, report.settings), report.recommendations);

  if (analysis.status !== "ok") {
    return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
  }

  const updated = await attachAi(weekEnd, {
    status: analysis.status,
    interpretation: analysis.interpretation,
    focus: analysis.focus,
  });

  return NextResponse.json(
    { status: "ok", interpretation: analysis.interpretation, focus: analysis.focus, updated: updated !== null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
