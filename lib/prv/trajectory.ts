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

/** Visual direction, shown in the report next to the verdict. */
export type TrendArrow = "↑" | "→" | "↓" | "?";

export interface TrajectoryVerdict {
  trajectory: Trajectory;
  /** The arrow the report prints, so the direction is legible at a glance. */
  arrow: TrendArrow;
  /** One line the report shows, with the numbers that produced it. */
  headline: string;
  /** The exact rule that fired, so the verdict is auditable rather than a black box. */
  rule: string;
  /**
   * Why the verdict is what it is, one measurable fact per line.
   *
   * Every line restates a number the metrics already produced. No line interprets effort, mood or
   * intention, and none of them explains a task away: the report says what is overdue, not why.
   */
  explain: string[];
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

  // The measurable facts behind the verdict. Each line is a figure the metrics already produced, so
  // the explanation can be checked against the tables rather than taken on trust.
  const explain: string[] = [
    `Progression pondérée de la période : ${Math.round(current.weightedProgress * 10) / 10} %.`,
    previous.length === 0
      ? "Aucune semaine précédente n'a encore été mesurée."
      : `Moyenne des ${previous.length} période(s) précédente(s) : ${Math.round(previousAverageOf(previous) * 10) / 10} %.`,
    `Tâches prévues terminées : ${metrics.completedPlanned.length}/${metrics.planned.length}.`,
    `Tâches terminées sur la période (hors plan) : ${metrics.completed.length}.`,
    `Tâches prévues non terminées : ${metrics.incomplete.length}.`,
    `Tâches en retard de plus de ${settings.overdueWarningDays} jours : ${metrics.longOverdue.length}.`,
    `Jours de la période : ${metrics.periodDays} · jours avec au moins un enregistrement : ${metrics.days.filter((d) => d.active).length}.`,
  ];

  if (points.length < 2) {
    return {
      trajectory: "insufficient-data",
      arrow: "?",
      headline: "Pas encore assez de périodes pour établir une tendance.",
      rule,
      explain,
      delta: null,
      points,
    };
  }

  const previousAverage = previousAverageOf(previous);
  const delta = Math.round((current.weightedProgress - previousAverage) * 10) / 10;

  const rateText =
    metrics.completionRate === null
      ? "aucune tâche prévue"
      : `${metrics.completionRate} % des tâches prévues`;

  if (delta >= settings.trendThreshold) {
    return {
      trajectory: "improving",
      arrow: "↑",
      headline: `Progression en hausse : +${delta} pts de progression pondérée (${rateText}).`,
      rule,
      explain,
      delta,
      points,
    };
  }
  if (delta <= -settings.trendThreshold) {
    return {
      trajectory: "slipping",
      arrow: "↓",
      headline: `Progression en baisse : ${delta} pts de progression pondérée (${rateText}).`,
      rule,
      explain,
      delta,
      points,
    };
  }
  return {
    trajectory: "stable",
    arrow: "→",
    headline: `Progression stable : ${delta >= 0 ? "+" : ""}${delta} pts (${rateText}).`,
    rule,
    explain,
    delta,
    points,
  };
}

function previousAverageOf(previous: TrendPoint[]): number {
  if (previous.length === 0) return 0;
  return previous.reduce((sum, p) => sum + p.weightedProgress, 0) / previous.length;
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
  const weekOnTrack =
    hasPlan && (metrics.completionRate ?? 0) >= settings.onTrackRate && metrics.longOverdue.length === 0;
  if (weekOnTrack) {
    out.push({
      kind: "reward",
      title: `Semaine tenue : ${metrics.completionRate} % des tâches prévues`,
      detail:
        "Objectifs atteints et rien qui traîne depuis plus de deux semaines. C'est le rythme de référence à reproduire.",
      evidence: [
        `${metrics.completedPlanned.length} tâche${metrics.completedPlanned.length > 1 ? "s" : ""} planifiée${metrics.completedPlanned.length > 1 ? "s" : ""} terminée${metrics.completedPlanned.length > 1 ? "s" : ""} sur ${metrics.planned.length}`,
        `${metrics.totals.openAtWeekEnd} tâche${metrics.totals.openAtWeekEnd > 1 ? "s" : ""} encore ouverte${metrics.totals.openAtWeekEnd > 1 ? "s" : ""} au total`,
        `Seuil « semaine tenue » paramétré : ${settings.onTrackRate} %`,
      ],
    });
  }

  /**
   * Rest allowance, measured rather than invented.
   *
   * `periodHours` is the difference between two real cumulative readings, so the suggestion can only
   * be made when that difference exists. Half the recorded study time is a fixed, inspectable rule -
   * no fatigue, health or motivation is inferred, and no amount is produced when nothing was measured.
   */
  if (weekOnTrack && metrics.periodHours !== null && metrics.periodHours > 0) {
    const rest = Math.round(metrics.periodHours / 2);
    out.push({
      kind: "reward",
      title: `Récompense suggérée : ${rest} h de repos.`,
      detail: `Environ la moitié des ${metrics.periodHours} h d'étude enregistrées sur la période, arrondies à l'heure. Montant calculé sur vos heures saisies, rien d'autre.`,
      evidence: [`Heures d'étude sur la période : ${metrics.periodHours} h (différence entre deux relevés réels)`],
    });
  }

  // --- corrective: the period's activity itself fell away ---
  if (verdict.trajectory === "slipping" || (metrics.activityCount === 0 && metrics.periodDays > 0)) {
    const activeDays = metrics.days.filter((d) => d.active).length;
    out.push({
      kind: "corrective",
      title: "Les indicateurs montrent une baisse d'activité cette période.",
      detail:
        "Le nombre d'enregistrements datés est inférieur à celui des périodes précédentes. Les chiffres ci-dessous décrivent l'activité, sans en expliquer la cause.",
      evidence: [
        `Événements datés sur la période : ${metrics.activityCount} (tâches terminées ${metrics.completed.length}, quiz ${metrics.quiz.attemptsInWeek}, notes ${metrics.journal.entriesInWeek})`,
        `Jours avec au moins un enregistrement : ${activeDays}/${metrics.periodDays}`,
        metrics.periodHours === null
          ? "Heures d'étude de la période : non mesurables (aucun relevé antérieur)."
          : `Heures d'étude de la période : ${metrics.periodHours} h`,
      ],
    });
  }

  // --- corrective: a real backlog left open ---
  if (
    hasPlan &&
    metrics.incomplete.length > 0 &&
    (metrics.unfinishedRate ?? 0) >= 50 &&
    metrics.longOverdue.length === 0
  ) {
    out.push({
      kind: "corrective",
      title: "Certaines tâches nécessitent un rattrapage.",
      detail: `Moitié des tâches prévues au moins non terminées à la fin de la période (${metrics.unfinishedRate} %). Les replanifier ou les retirer évite de les retrouver en retard la période suivante.`,
      evidence: metrics.incomplete
        .slice(0, 3)
        .map((t) => `« ${t.title} » — échéance ${t.deadline ?? "—"}`),
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
