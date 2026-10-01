/**
 * Deterministic weekly-report metrics.
 *
 * Everything in this file is arithmetic over the real snapshot: no AI, no randomness, no sample
 * data. The same snapshot always yields the same numbers, which is what lets a report be
 * regenerated, re-downloaded and compared week to week.
 *
 * The AI adds *interpretation* on top of these facts (see `ai.server.ts`); it never produces them.
 */

import { getModuleById, type ModuleDef } from "@/lib/modules";
import type { QuizResult, Task, TaskPriority, TaskStatus } from "@/lib/types";
import type { JournalSnapshot, ModuleRuntimeSnapshot, PrvSnapshot } from "./snapshot";
import {
  dayOfWeek,
  daysBetween,
  eachDay,
  formatDayName,
  formatShortDate,
  isWithin,
  periodLength,
  toIsoDate,
  type IsoDate,
  type WeekWindow,
} from "./weekly";

/** A task is "long overdue" past this many days, which is also the §35 warning threshold. */
export const OVERDUE_WARNING_DAYS = 14;

/**
 * One quiz attempt, with the day it happened.
 *
 * The store keeps only the latest result per chapter, so this is built from what is actually stored:
 * an attempt exists because a result carries a `completedAt`. It is never reconstructed or estimated.
 */
export interface QuizAttempt {
  moduleId: string;
  chapterId: string | null;
  date: IsoDate;
  completedAt: string;
  correct: number;
  incorrect: number;
  total: number;
  percentage: number;
}

/** What a module looked like at the end of the last report before this period. */
export interface ProgressBaseline {
  moduleId: string;
  objectivesDone: number;
  objectiveRate: number;
  chapterRate: number;
  /** Study hours are cumulative in the store, so the baseline value is a real earlier reading. */
  hoursStudied: number;
}

/**
 * One day of the period, built entirely from dated records in the store.
 *
 * There is no activity log in the app, so nothing here is written down as it happens: every figure
 * is derived from a date that already exists on a task, a quiz result or a journal entry. A day with
 * no dated record at all is reported as an empty day rather than being left out, so a week of
 * silence is visible instead of invisible.
 */
export interface DayActivity {
  date: IsoDate;
  dayOfWeek: number;
  /** "lundi 1 oct. 2026". */
  label: string;
  /** Tasks whose deadline falls on this day. */
  planned: number;
  /** Tasks that reached "completed" on this day. */
  completed: number;
  /** Tasks created on this day. */
  created: number;
  /** Planned on this day and still open at the end of the period. */
  missed: number;
  /** Open tasks already past due before this day - the backlog the day started with. */
  overdueAtDay: number;
  quizzes: number;
  journalEntries: number;
  /** True when at least one dated record exists for this day. */
  active: boolean;
}

export interface TaskRef {
  id: string;
  title: string;
  moduleId: string | null;
  chapterId?: string;
  deadline?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  notes?: string;
  source?: string;
  /** Days past due at `weekEnd`; 0 or less when not overdue. */
  daysOverdue: number;
  /** Weeks the task has been open, from creation to the end of the week. */
  ageDays: number;
}

export interface PriorityBucket {
  total: number;
  completed: number;
  open: number;
  completionRate: number;
}

export interface ModuleWeekStat {
  moduleId: string;
  code: string;
  name: string;
  color: string;
  /** Module coefficient from the curriculum, used by the weighted trajectory. */
  coefficient: number;
  planned: number;
  completed: number;
  open: number;
  completionRate: number;
  /** Completed objectives over total objectives, from the real store. */
  objectivesDone: number;
  objectivesTotal: number;
  objectiveRate: number;
  chaptersDone: number;
  chaptersTotal: number;
  chapterRate: number;
  hoursStudied: number;
  /**
   * Progress recorded for this module at the end of the previous report, or `null` when there is no
   * earlier report to read it from.
   *
   * The store holds one current value per objective and no history of objective toggles, so the only
   * real earlier reading available is a report that was already generated. `null` therefore means
   * "not measurable", and the report says so rather than printing a fabricated zero.
   */
  startProgress: number | null;
  /** Progress now: objectives completed over total, the unit the app actually tracks. */
  endProgress: number;
  /** `endProgress - startProgress`, or `null` without a baseline. */
  progressChange: number | null;
  startHours: number | null;
  hoursDelta: number | null;
  tasksCompletedInPeriod: number;
  quizAttemptsInPeriod: number;
  bestQuizPercentage: number | null;
  /** Objectives validated in the app's own completion model, plus what is left. */
  activitiesCompleted: number;
  activitiesRemaining: number;
  /** Chapters with real dated activity inside the period. */
  chaptersStudied: number;
}

export interface ChapterProgress {
  moduleId: string;
  chapterId: string;
  title: string;
  objectivesDone: number;
  objectivesTotal: number;
  rate: number;
  /** Best chapter quiz result during the week, when one exists. */
  quiz: QuizResult | null;
  openTasks: number;
  /** Tasks completed in this chapter inside the period. */
  completedInPeriod: number;
  /** Best quiz attempt in this chapter inside the period, when one exists. */
  quizInPeriod: QuizAttempt | null;
  /** True when the chapter has real dated activity inside the period. */
  studied: boolean;
}

export interface WeeklyMetrics {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  /** Inclusive number of days covered. 7 for a week, more for a custom range. */
  periodDays: number;
  /** Tasks whose deadline falls inside the week. */
  planned: TaskRef[];
  /** Tasks that reached "completed" during the week, whether or not they were on the plan. */
  completed: TaskRef[];
  /**
   * The subset of `planned` that was finished by the end of the week. Only these feed the
   * completion rate, so a task with no deadline - or one planned for a different week - can never
   * push a rate above 100%.
   */
  completedPlanned: TaskRef[];
  /** Planned for the week but not done by its end. */
  incomplete: TaskRef[];
  /**
   * Still open with a deadline before the week started: carried from earlier weeks.
   * A task can appear here *and* in `longOverdue` - a planning fact and an ageing fact overlap on
   * purpose, so the report can show both "what slipped" and "what is rotting". The UI shows
   * `longOverdue` as the subset to act on rather than counting the two lists twice.
   */
  carriedOver: TaskRef[];
  /** Open and past due by more than two weeks. Always a subset of `carriedOver`. */
  longOverdue: TaskRef[];
  /** Open and past due by at least one day. */
  overdue: TaskRef[];
  /** Tasks created during the week and not yet done. */
  createdThisWeek: TaskRef[];
  /** Open tasks with no deadline at all. */
  noDeadline: TaskRef[];
  totals: {
    openAtWeekEnd: number;
    completedAllTime: number;
    createdThisWeek: number;
    /**
     * Status counts over every task the report saw, not only the planned ones.
     *
     * The buckets are the store's own three statuses, so the distribution is a count rather than a
     * derivation: it can never be split differently from what the board shows.
     */
    byStatus: Record<TaskStatus, number>;
  };
  completionRate: number | null;
  byPriority: Record<TaskPriority, PriorityBucket>;
  modules: ModuleWeekStat[];
  chapters: ChapterProgress[];
  /** Study hours are cumulative in the store; the delta against the previous report is per week. */
  hours: {
    totalCumulative: number;
    byModuleCumulative: Record<string, number>;
  };
  quiz: {
    attemptsInWeek: number;
    bestInWeek: { moduleId: string; chapterId: string | null; percentage: number } | null;
    /** Every attempt dated inside the period, oldest first. */
    attempts: QuizAttempt[];
    /** Mean score across the period's attempts, or `null` when there was none. */
    averagePercentage: number | null;
    /** Highest and lowest attempt scores, or `null` when there was none. */
    bestPercentage: number | null;
    lowestPercentage: number | null;
    correctAnswers: number;
    totalQuestions: number;
  };
  /** One entry per day of the period, oldest first, including days with no activity. */
  days: DayActivity[];
  /** Real dated study events in the period: tasks completed + quiz attempts + journal entries. */
  activityCount: number;
  /** `incomplete / planned`, or `null` when nothing was planned. */
  unfinishedRate: number | null;
  /**
   * Study hours logged during the period, or `null` when no earlier reading exists to subtract from.
   *
   * The store keeps a cumulative figure per module, so a period's hours only exist as a difference
   * between two real readings. That difference is what a previous report provides, which is why this
   * is `null` until a second report exists.
   */
  periodHours: number | null;
  /** True when the period has no dated record at all: "no data", never "0 %". */
  emptyPeriod: boolean;
  journal: {
    entriesInWeek: number;
    /** The user's own words on what they did not understand. */
    unclear: string[];
    /** Total hours typed in the journal, if the user recorded any. */
    entries: JournalSnapshot[];
  };
  /** True when the snapshot contained no tasks at all, so the report says "no data" not "0%". */
  empty: boolean;
}

function toRef(task: Task, weekEnd: IsoDate): TaskRef {
  const deadline = toIsoDate(task.deadline);
  const created = toIsoDate(task.createdAt) ?? weekEnd;
  const daysOverdue =
    deadline && task.status !== "completed"
      ? Math.max(0, daysBetween(deadline, weekEnd))
      : 0;
  return {
    id: task.id,
    title: task.title,
    moduleId: task.moduleId,
    chapterId: task.chapterId,
    deadline: task.deadline,
    priority: task.priority,
    status: task.status,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    notes: task.notes,
    source: task.source,
    daysOverdue,
    ageDays: Math.max(0, daysBetween(created, weekEnd)),
  };
}

function emptyBucket(): PriorityBucket {
  return { total: 0, completed: 0, open: 0, completionRate: 0 };
}

function bucketFor(tasks: TaskRef[]): PriorityBucket {
  const completed = tasks.filter((t) => t.status === "completed").length;
  return {
    total: tasks.length,
    completed,
    open: tasks.length - completed,
    completionRate: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 1000) / 10,
  };
}

function objectiveTotals(moduleDef: ModuleDef | undefined, runtime: ModuleRuntimeSnapshot | undefined) {
  const total = moduleDef ? moduleDef.chapters.reduce((sum, c) => sum + c.objectives.length, 0) : 0;
  const status = runtime?.objectiveStatus;
  const done = status
    ? Object.entries(status).reduce((sum, [id, value]) => {
        // Only count objectives that actually belong to the module.
        const belongs = moduleDef?.chapters.some((c) => c.objectives.some((o) => o.id === id)) ?? false;
        return sum + (value && belongs ? 1 : 0);
      }, 0)
    : 0;
  return { done: Math.min(done, total || done), total };
}

function chapterProgress(
  snapshot: PrvSnapshot,
  week: WeekWindow,
  tasks: TaskRef[],
  attempts: QuizAttempt[]
): ChapterProgress[] {
  // Include every module that has either a runtime record or tasks, so a module is never reported
  // as having "0 chapters" merely because the store has no runtime entry for it yet.
  const moduleIds = new Set<string>([
    ...Object.keys(snapshot.moduleRuntime ?? {}),
    ...tasks.map((t) => t.moduleId).filter((id): id is string => id !== null),
  ]);

  const out: ChapterProgress[] = [];
  for (const moduleId of moduleIds) {
    const moduleDef = getModuleById(moduleId);
    if (!moduleDef) continue; // Progress for a module the app no longer knows about is ignored.
    const runtime = snapshot.moduleRuntime?.[moduleId];
    for (const chapter of moduleDef.chapters) {
      const objectivesTotal = chapter.objectives.length;
      const objectivesDone = chapter.objectives.reduce(
        (sum, objective) => sum + (runtime?.objectiveStatus?.[objective.id] ? 1 : 0),
        0
      );
      const quiz = snapshot.chapterQuiz?.[moduleId]?.[chapter.id] ?? null;
      const openTasks = tasks.filter(
        (t) => t.moduleId === moduleId && t.chapterId === chapter.id && t.status !== "completed"
      ).length;
      const completedInPeriod = tasks.filter(
        (t) =>
          t.moduleId === moduleId &&
          t.chapterId === chapter.id &&
          t.status === "completed" &&
          isWithin(toIsoDate(t.completedAt) ?? "", week.weekStart, week.weekEnd)
      ).length;
      const chapterAttempts = attempts.filter((a) => a.moduleId === moduleId && a.chapterId === chapter.id);
      const quizInPeriod =
        chapterAttempts.length === 0
          ? null
          : chapterAttempts.reduce((best, current) => (current.percentage > best.percentage ? current : best));
      out.push({
        moduleId,
        chapterId: chapter.id,
        title: chapter.title,
        objectivesDone,
        objectivesTotal,
        rate: objectivesTotal === 0 ? 0 : Math.round((objectivesDone / objectivesTotal) * 1000) / 10,
        quiz,
        openTasks,
        completedInPeriod,
        quizInPeriod,
        // "Studied" means a dated record exists for the chapter in this period - never inferred
        // from the chapter simply existing in the curriculum.
        studied: completedInPeriod > 0 || quizInPeriod !== null,
      });
    }
  }
  return out;
}

/**
 * Every quiz attempt whose result is dated inside the period, oldest first.
 *
 * Both stores are read: the per-chapter results and the older module-level ones. A result with an
 * unusable date is skipped rather than assigned to the period.
 */
function collectQuizAttempts(snapshot: PrvSnapshot, week: WeekWindow): QuizAttempt[] {
  const attempts: QuizAttempt[] = [];
  for (const [moduleId, byChapter] of Object.entries(snapshot.chapterQuiz ?? {})) {
    for (const [chapterId, result] of Object.entries(byChapter)) {
      const date = toIsoDate(result.completedAt);
      if (!date || !isWithin(date, week.weekStart, week.weekEnd)) continue;
      attempts.push({
        moduleId,
        chapterId,
        date,
        completedAt: result.completedAt,
        correct: result.correct,
        incorrect: result.incorrect,
        total: result.total,
        percentage: result.percentage,
      });
    }
  }
  for (const [moduleId, result] of Object.entries(snapshot.legacyQuiz ?? {})) {
    const date = toIsoDate(result.completedAt);
    if (!date || !isWithin(date, week.weekStart, week.weekEnd)) continue;
    attempts.push({
      moduleId,
      chapterId: null,
      date,
      completedAt: result.completedAt,
      correct: result.correct,
      incorrect: result.incorrect,
      total: result.total,
      percentage: result.percentage,
    });
  }
  return attempts.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

/**
 * One row per day of the period.
 *
 * Every column counts records that already carry that date, so a day genuinely without work reads as
 * zero rather than being invented. `overdueAtDay` is the number of still-open tasks whose deadline
 * was already behind at the start of the day: it is what makes a carried-over backlog visible
 * without attributing it to any one day.
 */
function buildDayActivity(
  week: WeekWindow,
  refs: TaskRef[],
  attempts: QuizAttempt[],
  journal: JournalSnapshot[]
): DayActivity[] {
  const days = eachDay(week.weekStart, week.weekEnd);
  const openAtEnd = refs.filter((t) => t.status !== "completed");

  return days.map((date) => {
    const dow = dayOfWeek(date);
    const planned = refs.filter((t) => toIsoDate(t.deadline) === date).length;
    const completed = refs.filter(
      (t) => t.status === "completed" && toIsoDate(t.completedAt) === date
    ).length;
    const created = refs.filter((t) => toIsoDate(t.createdAt) === date).length;
    const missed = openAtEnd.filter((t) => toIsoDate(t.deadline) === date).length;
    const overdueAtDay = openAtEnd.filter((t) => {
      const deadline = toIsoDate(t.deadline);
      return deadline !== null && deadline < date;
    }).length;
    const quizzes = attempts.filter((a) => a.date === date).length;
    const journalEntries = journal.filter((e) => e.date === date).length;

    return {
      date,
      dayOfWeek: dow,
      label: `${formatDayName(dow)} ${formatShortDate(date)}`,
      planned,
      completed,
      created,
      missed,
      overdueAtDay,
      quizzes,
      journalEntries,
      active: completed > 0 || created > 0 || quizzes > 0 || journalEntries > 0,
    };
  });
}

function moduleStats(
  snapshot: PrvSnapshot,
  week: WeekWindow,
  tasks: TaskRef[],
  chapters: ChapterProgress[],
  attempts: QuizAttempt[],
  baseline: ReadonlyMap<string, ProgressBaseline>
): ModuleWeekStat[] {
  const moduleIds = new Set<string>([
    ...tasks.map((t) => t.moduleId).filter((id): id is string => id !== null),
    ...Object.keys(snapshot.moduleRuntime ?? {}),
  ]);

  return [...moduleIds]
    .map((moduleId) => {
      const moduleDef = getModuleById(moduleId);
      const runtime = snapshot.moduleRuntime?.[moduleId];
      const moduleTasks = tasks.filter((t) => t.moduleId === moduleId);
      const planned = moduleTasks.filter((t) => isWithin(t.deadline ?? "", week.weekStart, week.weekEnd));
      // Counted within the week, so `completed / planned` never exceeds 100%.
      const completed = planned.filter((t) => isCompletedBy(t, week.weekEnd));
      const { done, total } = objectiveTotals(moduleDef, runtime);
      const moduleChapters = chapters.filter((c) => c.moduleId === moduleId);
      const chaptersDone = moduleChapters.filter((c) => c.objectivesTotal > 0 && c.rate === 100).length;
      const hoursStudied = runtime?.hoursStudied ?? 0;
      const objectiveRate = total === 0 ? 0 : Math.round((done / total) * 1000) / 10;
      const chapterRate =
        moduleChapters.length === 0 ? 0 : Math.round((chaptersDone / moduleChapters.length) * 1000) / 10;

      // Only a module with a measurable unit can carry a progress comparison at all.
      const base = baseline.get(moduleId);
      const startProgress = base && total > 0 ? base.objectiveRate : null;
      const moduleAttempts = attempts.filter((a) => a.moduleId === moduleId);

      return {
        moduleId,
        code: moduleDef?.code ?? moduleId,
        name: moduleDef?.name ?? "Module inconnu",
        color: moduleDef?.color ?? "#64748b",
        coefficient: moduleDef?.coefficient ?? 1,
        planned: planned.length,
        completed: completed.length,
        open: moduleTasks.filter((t) => t.status !== "completed").length,
        completionRate: planned.length === 0 ? 0 : Math.round((completed.length / planned.length) * 1000) / 10,
        objectivesDone: done,
        objectivesTotal: total,
        objectiveRate,
        chaptersDone,
        chaptersTotal: moduleChapters.length,
        chapterRate,
        hoursStudied,
        startProgress,
        endProgress: objectiveRate,
        progressChange: startProgress === null ? null : Math.round((objectiveRate - startProgress) * 10) / 10,
        startHours: base ? base.hoursStudied : null,
        hoursDelta: base ? Math.round((hoursStudied - base.hoursStudied) * 10) / 10 : null,
        tasksCompletedInPeriod: moduleTasks.filter(
          (t) =>
            t.status === "completed" &&
            isWithin(toIsoDate(t.completedAt) ?? "", week.weekStart, week.weekEnd)
        ).length,
        quizAttemptsInPeriod: moduleAttempts.length,
        bestQuizPercentage:
          moduleAttempts.length === 0
            ? null
            : moduleAttempts.reduce((best, a) => (a.percentage > best ? a.percentage : best), 0),
        activitiesCompleted: done,
        activitiesRemaining: Math.max(0, total - done),
        chaptersStudied: moduleChapters.filter((c) => c.studied).length,
      };
    })
    .sort((a, b) => a.coefficient - b.coefficient || a.code.localeCompare(b.code));
}

/** Keeps the payload small and gives the AI only what it can actually reason about. */
function collectUnclear(journal: JournalSnapshot[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of journal) {
    for (const field of [entry.notUnderstood, entry.questions, entry.problems] as const) {
      const text = field.trim();
      if (text.length === 0) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
      if (out.length >= 20) return out;
    }
  }
  return out;
}

/**
 * A task counts as finished for a week when it is completed and the completion happened no later
 * than the end of that week. A missing `completedAt` is treated as completed, because the store
 * only stamps the date when a task is ticked and an older report must not change retroactively.
 */
function isCompletedBy(task: TaskRef, weekEnd: IsoDate): boolean {
  if (task.status !== "completed") return false;
  const done = toIsoDate(task.completedAt);
  return done === null || done <= weekEnd;
}

/**
 * Computes every deterministic fact for one report period.
 *
 * The window is passed in rather than derived, because a report may cover a custom range as well as
 * a calendar week: every filter below is `isWithin(weekStart, weekEnd)`, so an arbitrary range
 * produces exactly the same kind of figures over a different number of days. A report generated by
 * the cron and one generated by hand for the same window therefore agree.
 *
 * `baseline` is optional and carries each module's progress as recorded by the *previous* report, so
 * "progress at the start" is a real earlier measurement. Without it those fields stay `null`.
 */
export function computeWeeklyMetrics(
  snapshot: PrvSnapshot,
  week: WeekWindow,
  baseline?: ReadonlyMap<string, ProgressBaseline> | ProgressBaseline[]
): WeeklyMetrics {
  const { weekStart, weekEnd } = week;
  const tasks = snapshot.tasks ?? [];
  const refs = tasks.map((t) => toRef(t, weekEnd));
  const baselineById = Array.isArray(baseline)
    ? new Map(baseline.map((b) => [b.moduleId, b]))
    : baseline ?? new Map<string, ProgressBaseline>();

  const planned = refs.filter((t) => t.deadline && isWithin(t.deadline, weekStart, weekEnd));
  const completed = refs.filter(
    (t) => t.status === "completed" && toIsoDate(t.completedAt) && isWithin(toIsoDate(t.completedAt)!, weekStart, weekEnd)
  );
  const completedPlanned = planned.filter((t) => isCompletedBy(t, weekEnd));
  const completedIds = new Set(completedPlanned.map((t) => t.id));
  const incomplete = planned.filter((t) => !completedIds.has(t.id));
  const open = refs.filter((t) => t.status !== "completed");

  const carriedOver = open.filter((t) => t.deadline && t.deadline < weekStart);
  const overdue = open.filter((t) => t.daysOverdue > 0);
  const longOverdue = open.filter((t) => t.daysOverdue > OVERDUE_WARNING_DAYS);
  const createdThisWeek = open.filter((t) => isWithin(toIsoDate(t.createdAt) ?? "", weekStart, weekEnd));
  const noDeadline = open.filter((t) => !t.deadline);

  const byPriority: Record<TaskPriority, PriorityBucket> = {
    prof: bucketFor(planned.filter((t) => t.priority === "prof")),
    important: bucketFor(planned.filter((t) => t.priority === "important")),
    normal: bucketFor(planned.filter((t) => t.priority === "normal")),
  };

  const quizAttempts = collectQuizAttempts(snapshot, week);
  const journalEntries = (snapshot.journal ?? []).filter((e) => isWithin(e.date, weekStart, weekEnd));

  const chapters = chapterProgress(snapshot, week, refs, quizAttempts);
  const modules = moduleStats(snapshot, week, refs, chapters, quizAttempts, baselineById);

  const byModuleCumulative: Record<string, number> = {};
  let totalCumulative = 0;
  for (const [moduleId, runtime] of Object.entries(snapshot.moduleRuntime ?? {})) {
    const hours = runtime?.hoursStudied ?? 0;
    byModuleCumulative[moduleId] = hours;
    totalCumulative += hours;
  }

  const bestInWeek =
    quizAttempts.length === 0
      ? null
      : quizAttempts.reduce<{ moduleId: string; chapterId: string | null; percentage: number } | null>(
          (best, current) =>
            best === null || current.percentage > best.percentage
              ? { moduleId: current.moduleId, chapterId: current.chapterId, percentage: current.percentage }
              : best,
          null
        );
  const percentages = quizAttempts.map((a) => a.percentage);
  const days = buildDayActivity(week, refs, quizAttempts, snapshot.journal ?? []);

  // Only a module that had an earlier reading can contribute a difference; with no baseline at all
  // the sum would read 0 h and be indistinguishable from a period genuinely spent doing nothing.
  const periodHours =
    baselineById.size === 0 || modules.every((m) => m.hoursDelta === null)
      ? null
      : Math.round(modules.reduce((sum, m) => sum + (m.hoursDelta ?? 0), 0) * 10) / 10;

  // Only dated records count as activity, and each is counted once: a completed task, a quiz attempt
  // and a journal note are three separate pieces of evidence, never a weighted "effort" score.
  const activityCount = completed.length + quizAttempts.length + journalEntries.length;

  return {
    weekStart,
    weekEnd,
    periodDays: periodLength(week),
    planned,
    completed,
    completedPlanned,
    incomplete,
    carriedOver,
    longOverdue,
    overdue,
    createdThisWeek,
    noDeadline,
    totals: {
      openAtWeekEnd: open.length,
      completedAllTime: refs.filter((t) => t.status === "completed").length,
      createdThisWeek: refs.filter((t) => isWithin(toIsoDate(t.createdAt) ?? "", weekStart, weekEnd)).length,
      byStatus: {
        todo: refs.filter((t) => t.status === "todo").length,
        in_progress: refs.filter((t) => t.status === "in_progress").length,
        completed: refs.filter((t) => t.status === "completed").length,
      },
    },
    completionRate:
      planned.length === 0
        ? null
        : Math.round((completedPlanned.length / planned.length) * 1000) / 10,
    unfinishedRate:
      planned.length === 0 ? null : Math.round((incomplete.length / planned.length) * 1000) / 10,
    activityCount,
    periodHours,
    byPriority,
    modules,
    chapters,
    hours: { totalCumulative, byModuleCumulative },
    quiz: {
      attemptsInWeek: quizAttempts.length,
      bestInWeek,
      attempts: quizAttempts,
      averagePercentage:
        percentages.length === 0
          ? null
          : Math.round((percentages.reduce((sum, p) => sum + p, 0) / percentages.length) * 100) / 100,
      bestPercentage: percentages.length === 0 ? null : Math.max(...percentages),
      lowestPercentage: percentages.length === 0 ? null : Math.min(...percentages),
      correctAnswers: quizAttempts.reduce((sum, a) => sum + a.correct, 0),
      totalQuestions: quizAttempts.reduce((sum, a) => sum + a.total, 0),
    },
    days,
    emptyPeriod: activityCount === 0 && planned.length === 0,
    journal: {
      entriesInWeek: journalEntries.length,
      unclear: collectUnclear(journalEntries),
      entries: journalEntries,
    },
    empty: tasks.length === 0,
  };
}

/** Flattened list of chapters with real activity in the period - the "what was studied" section. */
export function studiedChapters(metrics: WeeklyMetrics): ChapterProgress[] {
  return metrics.chapters.filter((chapter) => chapter.studied);
}

/** The per-module progress readings needed to compare a later period against this one. */
export function progressBaseline(metrics: WeeklyMetrics): ProgressBaseline[] {
  return metrics.modules
    .filter((module) => module.objectivesTotal > 0)
    .map((module) => ({
      moduleId: module.moduleId,
      objectivesDone: module.objectivesDone,
      objectiveRate: module.objectiveRate,
      chapterRate: module.chapterRate,
      hoursStudied: module.hoursStudied,
    }));
}

/**
 * Builds the per-module baseline for a period from the reports already stored.
 *
 * Only reports whose period ends *before* this one starts are eligible, and the most recent wins, so
 * the baseline is always the last real reading taken before the period opened. A report covering the
 * same period is excluded on purpose: it would make a module look unchanged by definition.
 */
export function baselineFromHistory(
  history: Array<{ weekStart: IsoDate; weekEnd: IsoDate; metrics: WeeklyMetrics }>,
  period: WeekWindow
): ProgressBaseline[] {
  const previous = history
    .filter((report) => report.weekEnd < period.weekStart)
    .sort((a, b) => a.weekEnd.localeCompare(b.weekEnd))
    .at(-1);
  return previous ? progressBaseline(previous.metrics) : [];
}
