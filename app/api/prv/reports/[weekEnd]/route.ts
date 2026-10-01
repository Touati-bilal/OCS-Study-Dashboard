/**
 * GET /api/prv/reports/[weekEnd] — one full weekly report.
 *
 * Authorised session required. The week is validated as a real date, and an unknown week answers
 * 404 rather than an empty report, so a typo is visible instead of silently showing zeros.
 */
import { NextResponse } from "next/server";

import { requirePrvAccess, isSameOrigin, unauthorized } from "@/lib/prv/guard.server";
import { findReport, saveObservations } from "@/lib/prv/reports.server";
import { getSettings } from "@/lib/prv/settings.server";
import { parseReportRef } from "@/lib/prv/weekly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { weekEnd: string } }) {
  if (!(await requirePrvAccess(request))) return unauthorized();

  const ref = parseReportRef(params.weekEnd);
  if (!ref) return NextResponse.json({ error: "Semaine invalide." }, { status: 400 });

  const report = findReport(params.weekEnd, getSettings());
  if (!report) return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });

  return NextResponse.json(
    {
      key: report.key,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      canonicalWeek: report.canonicalWeek,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      generation: report.generation,
      downloadId: report.downloadId,
      settings: report.settings,
      metrics: report.metrics,
      baseline: report.baseline ?? [],
      weightedProgress: report.weightedProgress,
      trajectory: report.trajectory,
      recommendations: report.recommendations,
      observations: report.observations ?? {},
      ai: report.ai,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * PATCH /api/prv/reports/[weekEnd] — save the owner's notes for this period.
 *
 * Writing notes must not recompute anything, so this touches the observations field only: the
 * metrics, the trend and the recommendations are byte-for-byte what the last generation produced.
 * The period must already have a report — notes are attached to a report, not to a range that has
 * never been analysed, so an unknown reference is a 404 rather than an empty record.
 */
export async function PATCH(request: Request, { params }: { params: { weekEnd: string } }) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  if (!(await isSameOrigin(request))) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  const ref = parseReportRef(params.weekEnd);
  if (!ref) return NextResponse.json({ error: "Semaine invalide." }, { status: 400 });

  const report = findReport(params.weekEnd, getSettings());
  if (!report) return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const updated = await saveObservations(
    { weekStart: report.weekStart, weekEnd: report.weekEnd },
    // The sanitiser is the trust boundary: it drops unknown keys, caps length and drops empties.
    raw.observations as unknown
  );
  if (!updated) return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });

  return NextResponse.json(
    { key: updated.key, observations: updated.observations, updatedAt: updated.updatedAt },
    { headers: { "Cache-Control": "no-store" } }
  );
}
