/**
 * Trajectory, weighting and recommendations for the weekly report.
 *
 * The rules here are explicit and readable on purpose: a report that says "you are slipping"
 * must be able to show exactly which numbers produced that sentence, and the owner must be able
 * to change the thresholds in Paramètres privés.
 *
 * Nothing here invents data, and nothing here marks a task done on its own.
 */

import type { TaskPriority } from "@/lib/types";
import { OVERDUE_WARNING_DAYS, type WeeklyMetrics } from "./metrics";
import { addDays, formatWeekRange, type IsoDate } from "./weekly";

/** Weight applied to the weighted progress of modules that use it. */
export const DEFAULT_MODERATED_MODULE_WEIGHTS: Record<string, number> = {
  M202: 0.75,
  M203: 0.75,
  M204: 0.75,
};

export interface ReportSettings {
  /** 0 = Sunday … 6 = Saturday. */
  reportDay: number;
  /** Per-module weight override; modules absent use `defaultModuleWeight`. */
  moduleWeights: Record<string, number>;
  defaultModuleWeight: number;
  /** Weeks of history used to judge a trend. */
  trendWindow: number;
  /** Completion-rate points of change between two weeks that count as a real movement. */
  trendThreshold: number;
  /** Completion rate at or above which the week counts as on track. */
  onTrackRate: number;
  /** Days of delay after which a task is called out as long overdue. */
  overdueWarningDays: number;
  /** Whether the AI section is offered at all. */
  aiEnabled: boolean;
}

export const DEFAULT_SETTINGS: ReportSettings = {
  reportDay: 0,
  moduleWeights: { ...DEFAULT_MODERATED_MODULE_WEIGHTS },
  defaultModuleWeight: 1,
  trendWindow: 4,
  trendThreshold: 10,
  onTrackRate: 70,
  overdueWarningDays: OVERDUE_WARNING_DAYS,
  aiEnabled: true,
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  prof: "demandé par le prof",
  important: "important",
  normal: "normal",
};

/** Clamps an untrusted settings payload onto `ReportSettings`. */
export function sanitizeSettings(input: unknown, base: ReportSettings = DEFAULT_SETTINGS): ReportSettings {
  if (input === null || typeof input !== "object") return { ...base };
  const raw = input as Record<string, unknown>;
  const weights: Record<string, number> = {};
  if (raw.moduleWeights !== null && typeof raw.moduleWeights === "object") {
    for (const [moduleId, value] of Object.entries(raw.moduleWeights as Record<string, unknown>)) {
      if (moduleId === "__proto__") continue;
      const weight = Number(value);
      // A weight outside 0…2 would distort every weighted figure, so it is rejected.
      if (Number.isFinite(weight) && weight >= 0 && weight <= 2) weights[moduleId] = weight;
    }
  }
  const reportDay = Number(raw.reportDay);
  const trendWindow = Math.round(Number(raw.trendWindow));
  const trendThreshold = Number(raw.trendThreshold);
  const onTrackRate = Number(raw.onTrackRate);
  const overdueWarningDays = Math.round(Number(raw.overdueWarningDays));
  const defaultModuleWeight = Number(raw.defaultModuleWeight);

  return {
    reportDay: Number.isInteger(reportDay) && reportDay >= 0 && reportDay <= 6 ? reportDay : base.reportDay,
    moduleWeights: Object.keys(weights).length > 0 ? weights : base.moduleWeights,
    defaultModuleWeight:
      Number.isFinite(defaultModuleWeight) && defaultModuleWeight >= 0 && defaultModuleWeight <= 2
        ? defaultModuleWeight
        : base.defaultModuleWeight,
    trendWindow: Number.isFinite(trendWindow) && trendWindow >= 2 && trendWindow <= 12 ? trendWindow : base.trendWindow,
    trendThreshold: Number.isFinite(trendThreshold) && trendThreshold >= 0 && trendThreshold <= 100 ? trendThreshold : base.trendThreshold,
    onTrackRate: Number.isFinite(onTrackRate) && onTrackRate >= 0 && onTrackRate <= 100 ? onTrackRate : base.onTrackRate,
    overdueWarningDays:
      Number.isFinite(overdueWarningDays) && overdueWarningDays >= 1 && overdueWarningDays <= 90
        ? overdueWarningDays
        : base.overdueWarningDays,
    aiEnabled: raw.aiEnabled === undefined ? base.aiEnabled : raw.aiEnabled === true,
  };
}

export function getModuleWeight(moduleId: string, settings: ReportSettings): number {
  const weight = settings.moduleWeights?.[moduleId];
  return typeof weight === "number" && weight >= 0 && weight <= 2
    ? weight
    : settings.defaultModuleWeight;
}

export interface TrendPoint {
  weekEnd: IsoDate;
  label: string;
  completionRate: number | null;
  weightedProgress: number;
}

/**
 * Weighted progress across modules, each scaled by its curriculum coefficient and by the owner's
 * per-module weight. This is what the 0.75 factor for M202/M203/M204 actually changes.
 */
export function weightedProgress(metrics: WeeklyMetrics, settings: ReportSettings): number {
  const scored = metrics.modules.filter((m) => m.objectivesTotal > 0 || m.chaptersTotal > 0);
  if (scored.length === 0) return 0;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const moduleStat of scored) {
    const weight =
      getModuleWeight(moduleStat.moduleId, settings) * (moduleStat.coefficient > 0 ? moduleStat.coefficient : 1);
    const rate = moduleStat.objectivesTotal > 0 ? moduleStat.objectiveRate : moduleStat.chapterRate;
    weightedSum += weight * rate;
    weightTotal += weight;
  }
  return weightTotal === 0 ? 0 : Math.round((weightedSum / weightTotal) * 10) / 10;
}

export type Trajectory = "improving" | "stable" | "slipping" | "insufficient-data";

export interface TrajectoryVerdict {
  trajectory: Trajectory;
  /** One line the report shows, with the numbers that produced it. */
  headline: string;
  /** The exact rule that fired, so the verdict is auditable rather than a black box. */
  rule: string;
  delta: number | null;
  points: TrendPoint[];
}

function completionRateOrZero(rate: number | null): number {
  return rate ?? 0;
}

/**
 * Judges the direction of travel from the current week and the previous ones.
 *
 * Rule, stated plainly: compare the current weighted progress with the average of the previous
 * `trendWindow` weeks. A gain of at least `trendThreshold` points is an improvement, a loss of at
 * least that much is a slip, anything between is stable. Fewer than two data points is reported as
 * insufficient data rather than guessed at.
 */
export function assessTrajectory(
  metrics: WeeklyMetrics,
  history: Array<{ weekEnd: IsoDate; completionRate: number | null; weightedProgress: number }>,
  settings: ReportSettings
): TrajectoryVerdict {
  const current: TrendPoint = {
    weekEnd: metrics.weekEnd,
    label: formatWeekRange(metrics.weekStart, metrics.weekEnd),
    completionRate: metrics.completionRate,
    weightedProgress: weightedProgress(metrics, settings),
  };
  const previous = history
    .filter((h) => h.weekEnd < metrics.weekEnd)
    .sort((a, b) => a.weekEnd.localeCompare(b.weekEnd))
    .slice(-settings.trendWindow)
    .map(
      (h): TrendPoint => ({
        weekEnd: h.weekEnd,
        // Each historical point is labelled with its own week, not the current one.
        label: formatWeekRange(addDays(h.weekEnd, -6), h.weekEnd),
        completionRate: h.completionRate,
        weightedProgress: h.weightedProgress,
      })
    );

  const points = [...previous, current];
  const rule = `écart ≥ ${settings.trendThreshold} pts entre la progression pondérée de la semaine et la moyenne des ${settings.trendWindow} semaines précédentes`;

  if (points.length < 2) {
    return {
      trajectory: "insufficient-data",
      headline: "Pas encore assez de semaines pour établir une tendance.",
      rule,
      delta: null,
      points,
    };
  }

  const previousAverage =
    previous.reduce((sum, p) => sum + p.weightedProgress, 0) / Math.max(1, previous.length);
  const delta = Math.round((current.weightedProgress - previousAverage) * 10) / 10;

  const rateText =
    metrics.completionRate === null
      ? "aucune tâche prévue"
      : `${metrics.completionRate} % des tâches prévues`;

  if (delta >= settings.trendThreshold) {
    return {
      trajectory: "improving",
      headline: `Progression en hausse : +${delta} pts de progression pondérée (${rateText}).`,
      rule,
      delta,
      points,
    };
  }
  if (delta <= -settings.trendThreshold) {
    return {
      trajectory: "slipping",
      headline: `Progression en baisse : ${delta} pts de progression pondérée (${rateText}).`,
      rule,
      delta,
      points,
    };
  }
  return {
    trajectory: "stable",
    headline: `Progression stable : ${delta >= 0 ? "+" : ""}${delta} pts (${rateText}).`,
    rule,
    delta,
    points,
  };
}

export type RecommendationKind = "reward" | "corrective" | "info";

export interface Recommendation {
  kind: RecommendationKind;
  title: string;
  detail: string;
  /** The numbers behind the recommendation, shown as-is in the report. */
  evidence: string[];
  /** Optional PRV task proposal, always requiring confirmation before it creates anything. */
  proposal?: { title: string; priority: TaskPriority; moduleId: string | null };
}

function topPriorityOf(tasks: WeeklyMetrics["planned"]): TaskPriority {
  if (tasks.some((t) => t.priority === "prof")) return "prof";
  if (tasks.some((t) => t.priority === "important")) return "important";
  return "normal";
}

/**
 * Recommendations derived only from the computed facts.
 *
 * A reward is a word, never a purchase or an automatic completion. A corrective action points at
 * concrete tasks and, where useful, proposes a task the owner still has to confirm.
 */
export function buildRecommendations(
  metrics: WeeklyMetrics,
  verdict: TrajectoryVerdict,
  settings: ReportSettings
): Recommendation[] {
  const out: Recommendation[] = [];

  // --- corrective: long overdue ---
  if (metrics.longOverdue.length > 0) {
    const worst = [...metrics.longOverdue].sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 3);
    out.push({
      kind: "corrective",
      title: `${metrics.longOverdue.length} tâche${metrics.longOverdue.length > 1 ? "s" : ""} en retard de plus de ${settings.overdueWarningDays} jours`,
      detail:
        "Ces tâches sont en retard depuis plus de deux semaines. Les traiter en premier, ou les retirer de la semaine si elles ne sont plus utiles, évite que la liste continue de grossir.",
      evidence: worst.map((t) => `« ${t.title} » — ${t.daysOverdue} jours de retard`),
      proposal: {
        title: `Reprendre : ${worst[0].title}`,
        priority: topPriorityOf(worst),
        moduleId: worst[0].moduleId,
      },
    });
  }

  // --- corrective: carryover ---
  if (metrics.carriedOver.length > 0) {
    out.push({
      kind: "corrective",
      title: `${metrics.carriedOver.length} tâche${metrics.carriedOver.length > 1 ? "s reportées" : " reportée"} d'une semaine antérieure`,
      detail:
        "Ces tâches avaient une date limite avant le début de cette semaine et sont toujours ouvertes. Soit elles sont replanifiées, soit elles sont abandonnées.",
      evidence: metrics.carriedOver
        .slice(0, 3)
        .map((t) => `« ${t.title} » — échéance ${t.deadline ?? "—"}`),
    });
  }

  // --- corrective: slipping trajectory ---
  if (verdict.trajectory === "slipping") {
    const weakest = [...metrics.modules]
      .filter((m) => m.objectivesTotal > 0)
      .sort((a, b) => a.objectiveRate - b.objectiveRate)[0];
    out.push({
      kind: "corrective",
      title: "La progression pondérée recule",
      detail: weakest
        ? `Le module le plus en retard est ${weakest.code} (${weakest.objectiveRate} % des objectifs). Une séance courte et ciblée sur ce module suffit à redresser la courbe.`
        : "La progression pondérée recule alors qu'aucun objectif n'est encore enregistré : commencez par valider un premier objectif.",
      evidence: [`${verdict.delta ?? 0} pts par rapport à la moyenne récente`],
    });
  }

  // --- reward: a clean, complete week ---
  const hasPlan = metrics.planned.length > 0;
  if (hasPlan && (metrics.completionRate ?? 0) >= settings.onTrackRate && metrics.longOverdue.length === 0) {
    out.push({
      kind: "reward",
      title: `Semaine tenue : ${metrics.completionRate} % des tâches prévues`,
      detail:
        "Objectifs atteints et rien qui traîne depuis plus de deux semaines. C'est le rythme de référence à reproduire.",
      evidence: [
        `${metrics.completedPlanned.length} tâche${metrics.completedPlanned.length > 1 ? "s" : ""} planifiée${metrics.completedPlanned.length > 1 ? "s" : ""} terminée${metrics.completedPlanned.length > 1 ? "s" : ""} sur ${metrics.planned.length}`,
        `${metrics.totals.openAtWeekEnd} tâche${metrics.totals.openAtWeekEnd > 1 ? "s" : ""} encore ouverte${metrics.totals.openAtWeekEnd > 1 ? "s" : ""} au total`,
      ],
    });
  }

  // --- info: no plan at all ---
  if (!hasPlan) {
    out.push({
      kind: "info",
      title: "Aucune tâche prévue cette semaine",
      detail:
        "Sans échéance dans la semaine, le taux de complétion n'est pas calculable. Ajouter une date limite à une ou deux tâches suffit à rendre le rapport hebdomadaire exploitable.",
      evidence: [`${metrics.totals.openAtWeekEnd} tâche${metrics.totals.openAtWeekEnd > 1 ? "s" : ""} ouverte${metrics.totals.openAtWeekEnd > 1 ? "s" : ""} sans échéance : ${metrics.noDeadline.length}`],
    });
  }

  // --- info: unclear points recorded by the owner ---
  if (metrics.journal.unclear.length > 0) {
    out.push({
      kind: "info",
      title: `${metrics.journal.unclear.length} point${metrics.journal.unclear.length > 1 ? "s" : ""} noté${metrics.journal.unclear.length > 1 ? "s" : ""} comme non compris`,
      detail:
        "Ces points viennent de vos notes de la semaine. Les travailler une fois chacun suffit à vider la liste.",
      evidence: metrics.journal.unclear.slice(0, 3).map((u) => `« ${u.length > 90 ? `${u.slice(0, 90)}…` : u} »`),
    });
  }

  // --- info: priority spread, so the load is visible ---
  const profCount = metrics.byPriority.prof.total;
  if (profCount > 0) {
    out.push({
      kind: "info",
      title: `${profCount} tâche${profCount > 1 ? "s" : ""} demandée${profCount > 1 ? "s" : ""} par le professeur`,
      detail: `Ces tâches sont marquées « ${PRIORITY_LABEL.prof} » et passent avant les autres dans le tableau.`,
      evidence: metrics.planned
        .filter((t) => t.priority === "prof")
        .slice(0, 3)
        .map((t) => `« ${t.title} »`),
    });
  }

  return out;
}
