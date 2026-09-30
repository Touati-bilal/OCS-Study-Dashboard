/**
 * Weekly report assembly and storage.
 *
 * A report is keyed on its week (`weekKey(weekEnd)`), which is what makes generation idempotent:
 * running the cron twice for the same week rewrites the same report instead of creating a second
 * one. Reports live in the private file store, are never written to `public/`, and are only ever
 * handed out by a route that has already checked the PRV session.
 */

import "server-only";

import { computeWeeklyMetrics, type WeeklyMetrics } from "./metrics";
import { readCollection, newOpaqueId, updateCollection } from "./store.server";
import {
  assessTrajectory,
  buildRecommendations,
  weightedProgress,
  DEFAULT_SETTINGS,
  type Recommendation,
  type ReportSettings,
  type TrajectoryVerdict,
  type TrendPoint,
} from "./trajectory";
import { getLastCompletedWeek, weekKey, type IsoDate, type WeekWindow } from "./weekly";
import type { PrvSnapshot } from "./snapshot";

export interface StoredReport {
  key: string;
  weekStart: IsoDate;
  weekEnd: IsoDate;
  createdAt: string;
  updatedAt: string;
  /** How many times this week has been generated; a re-run updates rather than duplicates. */
  generation: number;
  /** Unguessable id used in the download URL, so a week number is not a predictable path. */
  downloadId: string;
  settings: ReportSettings;
  metrics: WeeklyMetrics;
  weightedProgress: number;
  trajectory: TrajectoryVerdict;
  recommendations: Recommendation[];
  /** Filled in only when the AI ran. Facts above never depend on it. */
  ai: {
    status: string;
    interpretation: string[];
    focus: string[];
  };
}

function historyFor(reports: StoredReport[], weekEnd: IsoDate) {
  return reports
    .filter((r) => r.weekEnd < weekEnd)
    .map((r) => ({
      weekEnd: r.weekEnd,
      completionRate: r.metrics.completionRate,
      weightedProgress: r.weightedProgress,
    }));
}

export interface GenerateOptions {
  /** Which week to build. Defaults to the last completed week. */
  week?: WeekWindow;
  /** `"now"` or an explicit anchor, so a cron run and a manual run agree. */
  anchor?: IsoDate;
  settings?: ReportSettings;
  /** Interpretation produced earlier, or `null` to leave the report purely factual. */
  ai?: StoredReport["ai"] | null;
}

/**
 * Builds (or rebuilds) the report for one week from a snapshot.
 *
 * Pure with respect to the snapshot: the same snapshot and settings always produce the same
 * numbers, which is what lets a report be regenerated and compared.
 */
export function buildReport(snapshot: PrvSnapshot, options: GenerateOptions = {}): StoredReport {
  const settings = options.settings ?? DEFAULT_SETTINGS;
  const anchor = options.anchor ?? new Date().toISOString().slice(0, 10);
  const week = options.week ?? getLastCompletedWeek(anchor, settings.reportDay);
  const metrics = computeWeeklyMetrics(snapshot, week);
  return finalizeReport(metrics, settings, [], null);
}

/** Assembles the stored shape from computed metrics, using stored history for the trend. */
export function finalizeReport(
  metrics: WeeklyMetrics,
  settings: ReportSettings,
  historyReports: StoredReport[],
  ai: StoredReport["ai"] | null
): StoredReport {
  const trajectory = assessTrajectory(
    metrics,
    historyFor(historyReports, metrics.weekEnd),
    settings
  );
  return {
    key: weekKey(metrics.weekEnd),
    weekStart: metrics.weekStart,
    weekEnd: metrics.weekEnd,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    generation: 1,
    downloadId: newOpaqueId(18),
    settings,
    metrics,
    weightedProgress: weightedProgress(metrics, settings),
    trajectory,
    recommendations: buildRecommendations(metrics, trajectory, settings),
    ai: ai ?? { status: "pending", interpretation: [], focus: [] },
  };
}

export function listReports(): StoredReport[] {
  return readCollection<StoredReport>("reports").sort((a, b) => b.weekEnd.localeCompare(a.weekEnd));
}

export function findReportByWeek(weekEnd: IsoDate): StoredReport | undefined {
  return readCollection<StoredReport>("reports").find((r) => r.weekEnd === weekEnd);
}

/**
 * Stores a report idempotently on its week key.
 *
 * An existing report keeps its `createdAt` and its `downloadId` - so a PDF link handed out last
 * week keeps working - while its numbers, trend and generation counter are replaced.
 */
export async function saveReport(report: StoredReport): Promise<StoredReport> {
  let saved: StoredReport = report;
  const all = await updateCollection<StoredReport>("reports", (reports) => {
    const index = reports.findIndex((r) => r.weekEnd === report.weekEnd);
    if (index === -1) {
      saved = report;
      return [...reports, report];
    }
    const previous = reports[index];
    saved = {
      ...report,
      createdAt: previous.createdAt,
      downloadId: previous.downloadId,
      generation: (previous.generation ?? 1) + 1,
    };
    const next = [...reports];
    next[index] = saved;
    return next;
  });
  return all.find((r) => r.weekEnd === report.weekEnd) ?? saved;
}

/** Attaches an AI interpretation to an existing report without touching its facts. */
export async function attachAi(
  weekEnd: IsoDate,
  ai: StoredReport["ai"]
): Promise<StoredReport | null> {
  let updated: StoredReport | null = null;
  await updateCollection<StoredReport>("reports", (reports) =>
    reports.map((report) => {
      if (report.weekEnd !== weekEnd) return report;
      updated = { ...report, ai, updatedAt: new Date().toISOString() };
      return updated;
    })
  );
  return updated;
}

export function reportTrendPoints(reports: StoredReport[]): TrendPoint[] {
  return [...reports]
    .sort((a, b) => a.weekEnd.localeCompare(b.weekEnd))
    .slice(-8)
    .map((report) => ({
      weekEnd: report.weekEnd,
      label: report.weekEnd,
      completionRate: report.metrics.completionRate,
      weightedProgress: report.weightedProgress,
    }));
}
