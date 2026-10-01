/**
 * POST /api/prv/cron/weekly-report — generates the weekly report on schedule.
 *
 * Secured by a shared secret in the `x-prv-cron-secret` header, compared in constant time. When
 * `PRV_CRON_SECRET` is not set the endpoint refuses every request, so an unconfigured deployment
 * can never be triggered by anyone.
 *
 * Idempotency: the report is keyed on its week, so running this twice on the same day updates the
 * same report (its `generation` counter increments) rather than creating a second one.
 *
 * The data comes from the last snapshot the browser deposited. A cron cannot read `localStorage`,
 * so this reports the numbers as of the owner's last visit instead of inventing them - and says so
 * when no snapshot has been seen yet.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { baselineFromHistory, computeWeeklyMetrics } from "@/lib/prv/metrics";
import { finalizeReport, historyBefore, saveReport } from "@/lib/prv/reports.server";
import { getSettings } from "@/lib/prv/settings.server";
import { getLatestSnapshot } from "@/lib/prv/snapshot-store.server";
import { getLastCompletedWeek, todayIso } from "@/lib/prv/weekly";
import { sendPush } from "@/lib/prv/push.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const expected = process.env.PRV_CRON_SECRET?.trim();
  // Fail closed: without a configured secret nothing is allowed through.
  if (!expected || expected.length < 16) return false;
  const provided = request.headers.get("x-prv-cron-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let weekEndOverride: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.weekEnd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.weekEnd)) {
      weekEndOverride = body.weekEnd;
    }
  } catch {
    // An empty body is fine: the cron normally sends nothing.
  }

  const settings = getSettings();
  const period = getLastCompletedWeek(weekEndOverride ?? todayIso(), settings.reportDay);
  const stored = getLatestSnapshot();

  if (!stored) {
    return NextResponse.json(
      {
        ok: false,
        reason: "no-snapshot",
        message:
          "Aucun instantané local enregistré. Ouvrez la zone PRV une fois pour que le rapport automatique dispose de données réelles.",
      },
      { status: 409 }
    );
  }

  // Only earlier reports feed the trend and the start/end progress comparison, exactly as on screen.
  const history = historyBefore(period);
  const baseline = baselineFromHistory(history, period);
  const report = await saveReport(
    finalizeReport(computeWeeklyMetrics(stored.snapshot, period, baseline), settings, history, null)
  );

  // Optionally send the push; delivery is best-effort and never blocks the report.
  const wantsPush = request.headers.get("x-prv-notify") === "1";
  const push = wantsPush
    ? await sendPush({
        title: "Rapport PRV prêt",
        body: `Semaine du ${report.weekStart} au ${report.weekEnd} : ${report.metrics.completed.length} tâche(s) terminée(s).`,
        url: `/prv/rapports`,
      })
    : null;

  return NextResponse.json(
    {
      ok: true,
      key: report.key,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      generation: report.generation,
      snapshotAt: stored.storedAt,
      empty: report.metrics.empty,
      push,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
