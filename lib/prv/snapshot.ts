/**
 * The snapshot contract between the browser and the PRV report engine.
 *
 * The browser reads the *real* Zustand store and posts it here; the server never reads the store
 * itself, because that store lives in `localStorage` and is invisible to it. Everything arriving
 * from a client is therefore untrusted input, and `sanitizeSnapshot` is the single place where it
 * is validated, clamped and stripped of unknown fields.
 *
 * Nothing in this file may be imported by a client component; it is shared so the browser and the
 * server agree on the shape, but only the sanitiser runs on the server.
 */

import { getMainModules } from "@/lib/modules";
import type { QuizResult, Task, TaskPriority, TaskStatus } from "@/lib/types";

export const SNAPSHOT_VERSION = 1;

/** Hard ceilings, so a malicious or buggy client cannot make the server allocate without bound. */
export const LIMITS = {
  tasks: 5000,
  notes: 2000,
  objectivesPerModule: 500,
  moduleIds: 200,
  titleLength: 300,
  descriptionLength: 4000,
  notesLength: 4000,
  textLength: 2000,
  hoursStudied: 5000,
  quizTotal: 500,
  /** Characters of the report payload kept for the AI, to keep prompts small and cost down. */
  aiTextBudget: 12000,
} as const;

const TASK_PRIORITIES: readonly TaskPriority[] = ["prof", "important", "normal"];
const TASK_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "completed"];

/** Keys that must never be copied from client input, to avoid prototype pollution. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * The only module ids PRV accepts, derived from the OCS main modules (M201-M206) so it cannot drift
 * from the app's own definition.
 *
 * The browser already filters to these ids when it builds a snapshot, but the browser is the untrusted
 * side: the payload is a plain POST body, so a caller could otherwise post runtime, quiz and journal
 * data attributed to OCC, ORS or EGTS modules - or to any invented id - and have the private report
 * present another option's modules as the user's own work. So the server enforces the same rule
 * independently. Tasks with no module stay, exactly as `collectSnapshot` keeps them.
 */
const OCS_MODULE_IDS: ReadonlySet<string> = new Set(getMainModules("OCS").map((module) => module.id));

/** True for a known OCS module id, or for no module at all (a task not tied to a module). */
function isOcsModuleId(value: unknown): boolean {
  return typeof value === "string" && OCS_MODULE_IDS.has(value);
}

function str(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

function num(value: unknown, min: number, max: number, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function bool(value: unknown): boolean {
  return value === true;
}

function isoOrUndefined(value: unknown): string | undefined {
  const text = str(value, 40);
  return text.length > 0 && !Number.isNaN(Date.parse(text)) ? text : undefined;
}

function dateOrUndefined(value: unknown): string | undefined {
  const text = str(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

/** Copies only own enumerable keys, skipping anything that could poison `Object.prototype`. */
function safeEntries<T>(value: unknown, maxKeys: number): Array<[string, T]> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  const out: Array<[string, T]> = [];
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key) || out.length >= maxKeys) continue;
    out.push([key, (value as Record<string, T>)[key]]);
  }
  return out;
}

function sanitizeTask(input: unknown, index: number): Task | null {
  if (input === null || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const title = str(raw.title, LIMITS.titleLength);
  if (title.length === 0) return null;

  const priority = TASK_PRIORITIES.includes(raw.priority as TaskPriority)
    ? (raw.priority as TaskPriority)
    : "normal";
  const status = TASK_STATUSES.includes(raw.status as TaskStatus) ? (raw.status as TaskStatus) : "todo";

  const links = Array.isArray(raw.links)
    ? raw.links.map((l) => str(l, 300)).filter((l) => l.length > 0).slice(0, 20)
    : undefined;

  return {
    // A missing or unusable id must not collapse into one shared key, or two such tasks would
    // share a bucket in the metrics. The index guarantees uniqueness within the snapshot.
    id: str(raw.id, 64) || `idx-${index}`,
    title,
    description: str(raw.description, LIMITS.descriptionLength) || undefined,
    // Kept only when it is a real OCS module; an id from another option, or an invented one, is
    // dropped rather than reported as the user's work.
    moduleId: OCS_MODULE_IDS.has(str(raw.moduleId, 16)) ? str(raw.moduleId, 16) : null,
    chapterId: str(raw.chapterId, 16) || undefined,
    deadline: dateOrUndefined(raw.deadline),
    priority,
    status,
    createdAt: isoOrUndefined(raw.createdAt) ?? new Date(0).toISOString(),
    completedAt: isoOrUndefined(raw.completedAt),
    notes: str(raw.notes, LIMITS.notesLength) || undefined,
    links: links && links.length > 0 ? links : undefined,
    source: str(raw.source, 200) || undefined,
  };
}

function sanitizeQuizResult(input: unknown): QuizResult | null {
  if (input === null || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const total = Math.round(num(raw.total, 0, LIMITS.quizTotal));
  if (total <= 0) return null;
  const correct = Math.round(num(raw.correct, 0, total));
  const incorrect = Math.round(num(raw.incorrect, 0, total));
  const percentage = num(
    raw.percentage,
    0,
    100,
    total > 0 ? Math.round((correct / total) * 10000) / 100 : 0
  );
  return {
    correct,
    incorrect,
    total,
    percentage: Math.round(percentage * 100) / 100,
    completedAt: isoOrUndefined(raw.completedAt) ?? new Date(0).toISOString(),
  };
}

export interface ModuleRuntimeSnapshot {
  hoursStudied: number;
  objectiveStatus: Record<string, boolean>;
}

export interface JournalSnapshot {
  date: string;
  notUnderstood: string;
  questions: string;
  notes: string;
  problems: string;
}

export interface PrvSnapshot {
  version: number;
  generatedAt: string;
  tasks: Task[];
  moduleRuntime: Record<string, ModuleRuntimeSnapshot>;
  chapterQuiz: Record<string, Record<string, QuizResult>>;
  legacyQuiz: Record<string, QuizResult>;
  journal: JournalSnapshot[];
}

/** An empty, valid snapshot. Used when the store has no data yet - never filled with samples. */
export function emptySnapshot(): PrvSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    tasks: [],
    moduleRuntime: {},
    chapterQuiz: {},
    legacyQuiz: {},
    journal: [],
  };
}

/**
 * Validates and clamps an untrusted payload into a `PrvSnapshot`.
 *
 * Unknown fields are dropped rather than spread, every number is clamped, every string is
 * truncated, and only a known set of enum values is accepted. A payload that is not an object
 * yields an empty snapshot, so a malformed request produces an empty report instead of an error.
 */
export function sanitizeSnapshot(input: unknown): PrvSnapshot {
  const snapshot = emptySnapshot();
  if (input === null || typeof input !== "object" || Array.isArray(input)) return snapshot;
  const raw = input as Record<string, unknown>;

  snapshot.version = SNAPSHOT_VERSION;
  snapshot.generatedAt = isoOrUndefined(raw.generatedAt) ?? snapshot.generatedAt;

  if (Array.isArray(raw.tasks)) {
    const tasks: Task[] = [];
    for (const [index, candidate] of raw.tasks.slice(0, LIMITS.tasks).entries()) {
      const task = sanitizeTask(candidate, index);
      if (task) tasks.push(task);
    }
    snapshot.tasks = tasks;
  }

  for (const [moduleId, value] of safeEntries<unknown>(raw.moduleRuntime, LIMITS.moduleIds)) {
    if (!isOcsModuleId(moduleId)) continue;
    if (value === null || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const objectiveStatus: Record<string, boolean> = Object.create(null);
    for (const [objectiveId, done] of safeEntries<unknown>(entry.objectiveStatus, LIMITS.objectivesPerModule)) {
      objectiveStatus[objectiveId] = bool(done);
    }
    snapshot.moduleRuntime[moduleId] = {
      hoursStudied: num(entry.hoursStudied, 0, LIMITS.hoursStudied),
      objectiveStatus,
    };
  }

  for (const [moduleId, chapters] of safeEntries<unknown>(raw.chapterQuiz, LIMITS.moduleIds)) {
    if (!isOcsModuleId(moduleId)) continue;
    if (chapters === null || typeof chapters !== "object") continue;
    const byChapter: Record<string, QuizResult> = Object.create(null);
    for (const [chapterId, value] of safeEntries<unknown>(chapters, LIMITS.objectivesPerModule)) {
      const result = sanitizeQuizResult(value);
      if (result) byChapter[chapterId] = result;
    }
    if (Object.keys(byChapter).length > 0) snapshot.chapterQuiz[moduleId] = byChapter;
  }

  for (const [moduleId, value] of safeEntries<unknown>(raw.legacyQuiz, LIMITS.moduleIds)) {
    if (!isOcsModuleId(moduleId)) continue;
    const result = sanitizeQuizResult(value);
    if (result) snapshot.legacyQuiz[moduleId] = result;
  }

  if (Array.isArray(raw.journal)) {
    const journal: JournalSnapshot[] = [];
    for (const candidate of raw.journal.slice(0, LIMITS.notes)) {
      if (candidate === null || typeof candidate !== "object") continue;
      const entry = candidate as Record<string, unknown>;
      const date = dateOrUndefined(entry.date);
      if (!date) continue;
      journal.push({
        date,
        notUnderstood: str(entry.notUnderstood, LIMITS.textLength),
        questions: str(entry.questions, LIMITS.textLength),
        notes: str(entry.notes, LIMITS.textLength),
        problems: str(entry.problems, LIMITS.textLength),
      });
    }
    snapshot.journal = journal;
  }

  return snapshot;
}
