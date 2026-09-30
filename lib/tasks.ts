import type { Task, TaskPriority, TaskStatus } from "./types";
import { getModuleById } from "./modules";
import { daysUntil } from "./utils";

/**
 * Priority carries a colour and a *reason*; status carries the completion state.
 * They are deliberately independent: a red task can be "En cours" and a green one "À faire".
 */
export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; short: string; color: string; description: string }
> = {
  prof: {
    label: "Professeur",
    short: "Prof",
    color: "#fb7185",
    description: "Le professeur l'a demandé ou recommandé",
  },
  important: {
    label: "Important pour moi",
    short: "Important",
    color: "#fbbf24",
    description: "Je le considère important pour mon apprentissage",
  },
  normal: {
    label: "Normal",
    short: "Normal",
    color: "#34d399",
    description: "Utile pour plus tard, sans urgence",
  },
};

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; color: string; symbol: string }
> = {
  todo: { label: "À faire", color: "#94a3b8", symbol: "○" },
  in_progress: { label: "En cours", color: "#48a3ff", symbol: "◐" },
  completed: { label: "Terminé", color: "#34d399", symbol: "✓" },
};

export const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "completed"];

/** Ranks priorities from the most to the least constraining. */
const PRIORITY_RANK: Record<TaskPriority, number> = { prof: 0, important: 1, normal: 2 };

export function isTaskOpen(task: Task): boolean {
  return task.status !== "completed";
}

export function sortTasksByRelevance(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    // Tasks with a due date come first, soonest first; open-ended ones come last.
    if (a.deadline && b.deadline) {
      if (a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline);
    } else if (a.deadline !== b.deadline) {
      return a.deadline ? -1 : 1;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function getOpenTasks(tasks: Task[], moduleId?: string): Task[] {
  return sortTasksByRelevance(
    tasks.filter((t) => isTaskOpen(t)).filter((t) => (moduleId ? t.moduleId === moduleId : true))
  );
}

export function getCompletedTasks(tasks: Task[], moduleId?: string): Task[] {
  return tasks
    .filter((t) => !isTaskOpen(t))
    .filter((t) => (moduleId ? t.moduleId === moduleId : true))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

export function countOpenTasks(tasks: Task[]): number {
  return tasks.filter(isTaskOpen).length;
}

export function isTaskOverdue(task: Task): boolean {
  if (isTaskOpen(task) && task.deadline) return daysUntil(task.deadline) < 0;
  return false;
}

export function formatDeadline(task: Task): string | null {
  if (!task.deadline) return null;
  const delta = daysUntil(task.deadline);
  if (delta === 0) return "Aujourd'hui";
  if (delta === 1) return "Demain";
  if (delta === -1) return "Hier";
  if (delta < 0) return `En retard de ${Math.abs(delta)} j`;
  if (delta <= 7) return `Dans ${delta} j`;
  return new Date(task.deadline + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatCompletedAt(task: Task): string | null {
  if (!task.completedAt) return null;
  const date = new Date(task.completedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export interface TaskContext {
  moduleCode: string;
  moduleColor: string;
  moduleName: string;
  chapterTitle: string | null;
  href: string;
}

/** Resolves the module/chapter a task belongs to, for the "OCS / M201" label of a row. */
export function getTaskContext(task: Task): TaskContext | null {
  if (!task.moduleId) return null;
  const mod = getModuleById(task.moduleId);
  if (!mod) return null;
  const chapter = task.chapterId ? mod.chapters.find((c) => c.id === task.chapterId) : undefined;
  return {
    moduleCode: mod.code,
    moduleColor: mod.color,
    moduleName: mod.name,
    chapterTitle: chapter?.title ?? null,
    href: `/modules/${mod.id}`,
  };
}
