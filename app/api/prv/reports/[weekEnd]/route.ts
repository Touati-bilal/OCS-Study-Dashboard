/**
 * GET /api/prv/reports/[weekEnd] — one full weekly report.
 *
 * Authorised session required. The week is validated as a real date, and an unknown week answers
 * 404 rather than an empty report, so a typo is visible instead of silently showing zeros.
 */
import { NextResponse } from "next/server";

import { requirePrvAccess, unauthorized } from "@/lib/prv/guard.server";
import { findReportByWeek } from "@/lib/prv/reports.server";
import { toIsoDate } from "@/lib/prv/weekly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { weekEnd: string } }) {
  if (!(await requirePrvAccess(request))) return unauthorized();

  const weekEnd = toIsoDate(params.weekEnd);
  if (!weekEnd) return NextResponse.json({ error: "Semaine invalide." }, { status: 400 });

  const report = findReportByWeek(weekEnd);
  if (!report) return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });

  return NextResponse.json(
    {
      key: report.key,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      generation: report.generation,
      settings: report.settings,
      metrics: report.metrics,
      weightedProgress: report.weightedProgress,
      trajectory: report.trajectory,
      recommendations: report.recommendations,
      ai: report.ai,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
