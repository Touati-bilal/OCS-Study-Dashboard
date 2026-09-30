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
import { daysBetween, isWithin, toIsoDate, type IsoDate, type WeekWindow } from "./weekly";

/** A task is "long overdue" past this many days, which is also the §35 warning threshold. */
export const OVERDUE_WARNING_DAYS = 14;

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
}

export interface WeeklyMetrics {
  weekStart: IsoDate;
  weekEnd: IsoDate;
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
  };
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

function chapterProgress(snapshot: PrvSnapshot, week: WeekWindow, tasks: TaskRef[]): ChapterProgress[] {
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
      out.push({
        moduleId,
        chapterId: chapter.id,
        title: chapter.title,
        objectivesDone,
        objectivesTotal,
        rate: objectivesTotal === 0 ? 0 : Math.round((objectivesDone / objectivesTotal) * 1000) / 10,
        quiz,
        openTasks,
      });
    }
  }
  void week;
  return out;
}

function moduleStats(
  snapshot: PrvSnapshot,
  week: WeekWindow,
  tasks: TaskRef[],
  chapters: ChapterProgress[]
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
        objectiveRate: total === 0 ? 0 : Math.round((done / total) * 1000) / 10,
        chaptersDone,
        chaptersTotal: moduleChapters.length,
        chapterRate:
          moduleChapters.length === 0
            ? 0
            : Math.round((chaptersDone / moduleChapters.length) * 1000) / 10,
        hoursStudied: runtime?.hoursStudied ?? 0,
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
 * Computes every deterministic fact for one report week.
 *
 * `anchor` is the "today" the report is generated for; the week is derived from it, so a report
 * generated by the cron and one generated by hand on the same day agree.
 */
export function computeWeeklyMetrics(snapshot: PrvSnapshot, week: WeekWindow): WeeklyMetrics {
  const { weekStart, weekEnd } = week;
  const tasks = snapshot.tasks ?? [];
  const refs = tasks.map((t) => toRef(t, weekEnd));

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

  const chapters = chapterProgress(snapshot, week, refs);
  const modules = moduleStats(snapshot, week, refs, chapters);

  const byModuleCumulative: Record<string, number> = {};
  let totalCumulative = 0;
  for (const [moduleId, runtime] of Object.entries(snapshot.moduleRuntime ?? {})) {
    const hours = runtime?.hoursStudied ?? 0;
    byModuleCumulative[moduleId] = hours;
    totalCumulative += hours;
  }

  const quizAttempts: Array<{ moduleId: string; chapterId: string | null; percentage: number }> = [];
  for (const [moduleId, byChapter] of Object.entries(snapshot.chapterQuiz ?? {})) {
    for (const [chapterId, result] of Object.entries(byChapter)) {
      if (isWithin(toIsoDate(result.completedAt) ?? "", weekStart, weekEnd)) {
        quizAttempts.push({ moduleId, chapterId, percentage: result.percentage });
      }
    }
  }
  for (const [moduleId, result] of Object.entries(snapshot.legacyQuiz ?? {})) {
    if (isWithin(toIsoDate(result.completedAt) ?? "", weekStart, weekEnd)) {
      quizAttempts.push({ moduleId, chapterId: null, percentage: result.percentage });
    }
  }
  const bestInWeek =
    quizAttempts.length === 0
      ? null
      : quizAttempts.reduce((best, current) => (current.percentage > best.percentage ? current : best));

  const journalEntries = (snapshot.journal ?? []).filter((e) => isWithin(e.date, weekStart, weekEnd));

  return {
    weekStart,
    weekEnd,
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
    },
    completionRate:
      planned.length === 0
        ? null
        : Math.round((completedPlanned.length / planned.length) * 1000) / 10,
    byPriority,
    modules,
    chapters,
    hours: { totalCumulative, byModuleCumulative },
    quiz: { attemptsInWeek: quizAttempts.length, bestInWeek },
    journal: {
      entriesInWeek: journalEntries.length,
      unclear: collectUnclear(journalEntries),
      entries: journalEntries,
    },
    empty: tasks.length === 0,
  };
}
