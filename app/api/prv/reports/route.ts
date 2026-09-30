/**
 * GET  /api/prv/reports — list stored weekly reports (facts only, no AI payload).
 * POST /api/prv/reports — generate the report for a week from a real store snapshot.
 *
 * The POST body is client-supplied, so it goes through `sanitizeSnapshot` before any arithmetic
 * touches it. Generation is keyed on the week, so calling it twice for the same week updates one
 * report instead of creating a duplicate.
 */
import { NextResponse } from "next/server";

import { requirePrvAccess, isSameOrigin, unauthorized } from "@/lib/prv/guard.server";
import { computeWeeklyMetrics } from "@/lib/prv/metrics";
import { finalizeReport, listReports, reportTrendPoints, saveReport } from "@/lib/prv/reports.server";
import { getSettings } from "@/lib/prv/settings.server";
import { saveLatestSnapshot } from "@/lib/prv/snapshot-store.server";
import { sanitizeSnapshot } from "@/lib/prv/snapshot";
import { getLastCompletedWeek, todayIso, toIsoDate } from "@/lib/prv/weekly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requirePrvAccess(request))) return unauthorized();
  const reports = listReports();
  return NextResponse.json(
    {
      reports: reports.map((report) => ({
        key: report.key,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        generation: report.generation,
        weightedProgress: report.weightedProgress,
        trajectory: report.trajectory.trajectory,
        completionRate: report.metrics.completionRate,
        planned: report.metrics.planned.length,
        completed: report.metrics.completed.length,
        longOverdue: report.metrics.longOverdue.length,
        empty: report.metrics.empty,
        aiStatus: report.ai?.status ?? "pending",
        // The unguessable id the PDF route also requires. Safe to return here because the caller
        // already holds a valid session; without it the link would just 403.
        downloadId: report.downloadId,
      })),
      trend: reportTrendPoints(reports),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
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

  const raw = (body ?? {}) as Record<string, unknown>;
  const settings = getSettings();
  const snapshot = sanitizeSnapshot(raw.snapshot);

  // The window is derived as a whole from the anchor, so weekStart and weekEnd can never disagree.
  const anchor = toIsoDate(typeof raw.weekEnd === "string" ? raw.weekEnd : null) ?? todayIso();
  const week = getLastCompletedWeek(anchor, settings.reportDay);

  // Keep the newest real snapshot server-side so the weekly cron has genuine data to build from.
  await saveLatestSnapshot(snapshot);

  // The trend uses the reports stored *before* this one, so a rebuild cannot feed on its own numbers.
  const history = listReports().filter((report) => report.weekEnd !== week.weekEnd);
  const report = await saveReport(
    finalizeReport(computeWeeklyMetrics(snapshot, week), settings, history, null)
  );

  return NextResponse.json(
    {
      key: report.key,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      generation: report.generation,
      weightedProgress: report.weightedProgress,
      trajectory: report.trajectory,
      empty: report.metrics.empty,
    },
    { status: report.generation > 1 ? 200 : 201, headers: { "Cache-Control": "no-store" } }
  );
}
