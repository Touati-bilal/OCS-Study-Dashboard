/**
 * Weekly report assembly and storage.
 *
 * A report is keyed on its week (`weekKey(weekEnd)`), which is what makes generation idempotent:
 * running the cron twice for the same week rewrites the same report instead of creating a second
 * one. Reports live in the private file store, are never written to `public/`, and are only ever
 * handed out by a route that has already checked the PRV session.
 */

import "server-only";

import { sanitizeObservations, type Observations } from "./observations";
import {
  baselineFromHistory,
  computeWeeklyMetrics,
  progressBaseline,
  type ProgressBaseline,
  type WeeklyMetrics,
} from "./metrics";
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
import {
  addDays,
  getLastCompletedWeek,
  isCanonicalWeek,
  parseReportRef,
  periodKey,
  type IsoDate,
  type WeekWindow,
} from "./weekly";
import type { PrvSnapshot } from "./snapshot";

export interface StoredReport {
  /**
   * `p-<start>_<end>` for a period, `w-<end>` for reports stored before arbitrary ranges existed.
   *
   * Both are valid identifiers and both are accepted on lookup; `findReport` resolves a reference to
   * a record by matching the window, never by trusting the key string.
   */
  key: string;
  weekStart: IsoDate;
  weekEnd: IsoDate;
  /** True when the window is a full calendar week rather than a custom range. */
  canonicalWeek: boolean;
  createdAt: string;
  updatedAt: string;
  /** How many times this period has been generated; a re-run updates rather than duplicates. */
  generation: number;
  /** Unguessable id used in the download URL, so a period is not a predictable path. */
  downloadId: string;
  settings: ReportSettings;
  metrics: WeeklyMetrics;
  /** Per-module progress as read by the previous report, or `[]` when there was none. */
  baseline: ProgressBaseline[];
  weightedProgress: number;
  trajectory: TrajectoryVerdict;
  recommendations: Recommendation[];
  /** The owner's own notes for this period. Empty until they write something. */
  observations: Observations;
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
  /** Which period to build. Defaults to the last completed week. */
  week?: WeekWindow;
  /** `"now"` or an explicit anchor, so a cron run and a manual run agree. */
  anchor?: IsoDate;
  settings?: ReportSettings;
  /** Interpretation produced earlier, or `null` to leave the report purely factual. */
  ai?: StoredReport["ai"] | null;
  /** Per-module progress as read before the period opened, for the start/end comparison. */
  baseline?: ProgressBaseline[];
  /** Notes already written for this period; a rebuild keeps them rather than dropping them. */
  observations?: Observations;
}

/**
 * Builds (or rebuilds) the report for one period from a snapshot.
 *
 * Pure with respect to the snapshot: the same snapshot, period and settings always produce the same
 * numbers, which is what lets a report be regenerated and compared.
 */
export function buildReport(snapshot: PrvSnapshot, options: GenerateOptions = {}): StoredReport {
  const settings = options.settings ?? DEFAULT_SETTINGS;
  const anchor = options.anchor ?? new Date().toISOString().slice(0, 10);
  const period = options.week ?? getLastCompletedWeek(anchor, settings.reportDay);
  const metrics = computeWeeklyMetrics(snapshot, period, options.baseline);
  return finalizeReport(metrics, settings, [], null, options.observations);
}

/** Assembles the stored shape from computed metrics, using stored history for the trend. */
export function finalizeReport(
  metrics: WeeklyMetrics,
  settings: ReportSettings,
  historyReports: StoredReport[],
  ai: StoredReport["ai"] | null,
  observations?: Observations,
  baseline: ProgressBaseline[] = baselineFromHistory(historyReports, metrics)
): StoredReport {
  const period: WeekWindow = { weekStart: metrics.weekStart, weekEnd: metrics.weekEnd };
  const trajectory = assessTrajectory(
    metrics,
    historyFor(historyReports, metrics.weekEnd),
    settings
  );
  return {
    key: periodKey(period),
    weekStart: metrics.weekStart,
    weekEnd: metrics.weekEnd,
    canonicalWeek: isCanonicalWeek(period, settings.reportDay),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    generation: 1,
    downloadId: newOpaqueId(18),
    settings,
    metrics,
    baseline,
    weightedProgress: weightedProgress(metrics, settings),
    trajectory,
    recommendations: buildRecommendations(metrics, trajectory, settings),
    observations: observations ?? {},
    ai: ai ?? { status: "pending", interpretation: [], focus: [] },
  };
}

/** True when two records cover exactly the same period. */
function sameWindow(a: { weekStart: string; weekEnd: string }, b: { weekStart: string; weekEnd: string }): boolean {
  return a.weekStart === b.weekStart && a.weekEnd === b.weekEnd;
}

export function listReports(): StoredReport[] {
  return readCollection<StoredReport>("reports").sort(
    (a, b) => b.weekStart.localeCompare(a.weekStart) || b.weekEnd.localeCompare(a.weekEnd)
  );
}

/** Every report whose window ends before the given one, oldest first: the trend's history. */
export function historyBefore(period: WeekWindow): StoredReport[] {
  return readCollection<StoredReport>("reports")
    .filter((report) => report.weekEnd < period.weekStart)
    .sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
}

/**
 * Looks a report up by any reference a URL may carry.
 *
 * The match is on the *window*, not on the key string, which is what keeps reports written before
 * arbitrary ranges existed reachable: a stored `w-2026-09-27` and a freshly generated
 * `p-2026-09-21_2026-09-27` describe the same period and resolve to each other.
 *
 * A bare end date prefers the canonical week ending that day, so an old bookmarked link can never be
 * silently re-pointed at an unrelated custom range that happens to end on the same date.
 */
export function findReport(ref: string, settings: ReportSettings = DEFAULT_SETTINGS): StoredReport | undefined {
  const period = parseReportRef(ref);
  if (!period) return undefined;
  const reports = readCollection<StoredReport>("reports");

  const exact = reports.find((report) => report.key === ref.trim());
  if (exact) return exact;

  const window = reports.find((report) => sameWindow(report, period));
  if (window) return window;

  if (period.weekStart === addDays(period.weekEnd, -6)) {
    // A bare date only: take the canonical week ending there.
    return reports.find(
      (report) => report.weekEnd === period.weekEnd && isCanonicalWeek(report, settings.reportDay)
    );
  }
  return reports.find((report) => report.weekEnd === period.weekEnd);
}

/** The report whose period is exactly this one, or `undefined`. */
export function findReportByPeriod(period: WeekWindow, settings?: ReportSettings): StoredReport | undefined {
  return findReport(periodKey(period), settings);
}

/**
 * Legacy lookup by week end alone, kept for the AI and the weekly cron.
 *
 * Delegates to `findReport` so there is still one resolution rule in the codebase; the canonical week
 * preference means it finds the week report rather than an arbitrary range.
 */
export function findReportByWeek(weekEnd: IsoDate, settings?: ReportSettings): StoredReport | undefined {
  return findReport(weekEnd, settings);
}

/**
 * Stores a report idempotently on its period.
 *
 * An existing report keeps its `createdAt` and its `downloadId` - so a PDF link handed out last week
 * keeps working - while its numbers, trend, notes and generation counter are replaced. Matching on
 * the window rather than the key is what makes an existing `w-` report update in place instead of
 * being duplicated by a `p-` key.
 */
export async function saveReport(report: StoredReport): Promise<StoredReport> {
  let saved: StoredReport = report;
  await updateCollection<StoredReport>("reports", (reports) => {
    const index = reports.findIndex((r) => sameWindow(r, report));
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
      // A rebuild must not silently discard notes the owner already wrote for this period.
      observations: Object.keys(report.observations ?? {}).length > 0 ? report.observations : previous.observations ?? {},
    };
    const next = [...reports];
    next[index] = saved;
    return next;
  });
  return saved;
}

/** Attaches an AI interpretation to an existing report without touching its facts. */
export async function attachAi(weekEnd: IsoDate, ai: StoredReport["ai"]): Promise<StoredReport | null> {
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

/**
 * Saves the owner's notes for one period.
 *
 * Notes are the only thing this writes: the metrics, the trend and the recommendations are never
 * touched by an edit to a text field, and re-saving the same text is harmless.
 */
export async function saveObservations(
  period: WeekWindow,
  observations: unknown
): Promise<StoredReport | null> {
  const cleaned = sanitizeObservations(observations);
  let updated: StoredReport | null = null;
  await updateCollection<StoredReport>("reports", (reports) =>
    reports.map((report) => {
      if (!sameWindow(report, period)) return report;
      updated = { ...report, observations: cleaned, updatedAt: new Date().toISOString() };
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

export { progressBaseline };
