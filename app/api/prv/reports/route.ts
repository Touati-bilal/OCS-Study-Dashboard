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
import { baselineFromHistory, computeWeeklyMetrics } from "@/lib/prv/metrics";
import {
  finalizeReport,
  historyBefore,
  listReports,
  reportTrendPoints,
  saveReport,
} from "@/lib/prv/reports.server";
import { getSettings } from "@/lib/prv/settings.server";
import { hasObservations } from "@/lib/prv/observations";
import { saveLatestSnapshot } from "@/lib/prv/snapshot-store.server";
import { sanitizeSnapshot } from "@/lib/prv/snapshot";
import { getLastCompletedWeek, normalisePeriod, todayIso, toIsoDate } from "@/lib/prv/weekly";

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
        arrow: report.trajectory.arrow,
        completionRate: report.metrics.completionRate,
        unfinishedRate: report.metrics.unfinishedRate,
        planned: report.metrics.planned.length,
        completed: report.metrics.completed.length,
        overdue: report.metrics.overdue.length,
        longOverdue: report.metrics.longOverdue.length,
        periodDays: report.metrics.periodDays,
        activityCount: report.metrics.activityCount,
        canonicalWeek: report.canonicalWeek,
        empty: report.metrics.empty,
        hasObservations: hasObservations(report.observations),
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

  /**
   * The analysis period.
   *
   * A caller may name any range with `start`/`end`; `weekEnd` is the older form and still resolves to
   * the canonical week ending on that day, which is what the cron and the previous screen send. Both
   * ends are validated together by `normalisePeriod`, so an inverted or oversized range is refused
   * rather than silently reinterpreted, and `weekStart`/`weekEnd` can never disagree.
   */
  const explicitPeriod = normalisePeriod(raw.start, raw.end);
  const weekEndAnchor = toIsoDate(typeof raw.weekEnd === "string" ? raw.weekEnd : null);
  const period =
    explicitPeriod ??
    getLastCompletedWeek(weekEndAnchor ?? todayIso(), settings.reportDay);
  if (raw.start !== undefined || raw.end !== undefined) {
    if (!explicitPeriod) {
      return NextResponse.json(
        { error: "Période invalide : les deux dates doivent être réelles, dans l'ordre, et couvrir au plus un an." },
        { status: 400 }
      );
    }
  }

  // Keep the newest real snapshot server-side so the weekly cron has genuine data to build from.
  await saveLatestSnapshot(snapshot);

  /**
   * The trend and the start/end progress comparison both read earlier reports only.
   *
   * Reports covering this same period are left out on purpose: a rebuild must not become its own
   * baseline, or "progress since the start of the week" would always read as no change.
   */
  const history = historyBefore(period);
  const baseline = baselineFromHistory(history, period);

  const report = await saveReport(
    finalizeReport(computeWeeklyMetrics(snapshot, period, baseline), settings, history, null)
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
