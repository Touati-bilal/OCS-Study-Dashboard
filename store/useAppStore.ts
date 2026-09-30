"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ALL_MODULES, ChapterDef } from "@/lib/modules";
import { quizKey } from "@/lib/quizzes";
import { uid, todayISO } from "@/lib/utils";
import type {
  ChapterStatus,
  Exam,
  Internship,
  InternshipEvent,
  JournalEntry,
  ModuleRuntime,
  Note,
  QuizResult,
  StudyOption,
  Task,
  TaskPriority,
  TaskStatus,
  Theme,
} from "@/lib/types";

function emptyModuleRuntime(): ModuleRuntime {
  return { hoursStudied: 0, ccGrade: null, efmGrade: null, objectiveStatus: {} };
}

/**
 * Priorities used before V1.09-02 were a magnitude (low / medium / high) and are mapped onto
 * the new reason-based scale. No task is dropped: only the label changes.
 */
const LEGACY_PRIORITY_MAP: Record<string, TaskPriority> = {
  high: "prof",
  medium: "important",
  low: "normal",
};

export function normalizeTaskPriority(value: unknown): TaskPriority {
  if (value === "prof" || value === "important" || value === "normal") return value;
  return LEGACY_PRIORITY_MAP[String(value)] ?? "normal";
}

interface AppState {
  theme: Theme;
  studyOption: StudyOption | null;
  modules: Record<string, ModuleRuntime>;
  tasks: Task[];
  internships: Internship[];
  internshipEvents: InternshipEvent[];
  journalEntries: JournalEntry[];
  exams: Exam[];
  notes: Note[];
  /** Kept as-is: results of the module-level quizzes used before quizzes became chapter-level. */
  quizResults: Record<string, QuizResult>;
  /** Chapter-level quiz results, keyed by `moduleId:chapterId` (see `quizKey`). */
  chapterQuizResults: Record<string, QuizResult>;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  setStudyOption: (option: StudyOption) => void;

  getModuleRuntime: (moduleId: string) => ModuleRuntime;
  toggleObjective: (moduleId: string, objectiveId: string) => void;
  setChapterObjectives: (moduleId: string, objectiveIds: string[], done: boolean) => void;
  setHoursStudied: (moduleId: string, hours: number) => void;
  addHours: (moduleId: string, delta: number) => void;
  setGrades: (moduleId: string, cc: number | null, efm: number | null) => void;

  addNote: (moduleId: string, text: string) => void;
  deleteNote: (id: string) => void;

  saveQuizResult: (moduleId: string, result: QuizResult) => void;
  clearQuizResult: (moduleId: string) => void;
  saveChapterQuizResult: (moduleId: string, chapterId: string, result: QuizResult) => void;
  clearChapterQuizResult: (moduleId: string, chapterId: string) => void;

  addTask: (task: Omit<Task, "id" | "createdAt" | "status"> & { status?: TaskStatus }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  moveTask: (id: string, deadline?: string) => void;

  addInternship: (i: Omit<Internship, "id">) => string;
  updateInternship: (id: string, patch: Partial<Internship>) => void;
  deleteInternship: (id: string) => void;

  addInternshipEvent: (e: Omit<InternshipEvent, "id">) => void;
  updateInternshipEvent: (id: string, patch: Partial<InternshipEvent>) => void;
  deleteInternshipEvent: (id: string) => void;

  upsertJournalEntry: (entry: Omit<JournalEntry, "id" | "updatedAt"> & { id?: string }) => void;
  deleteJournalEntry: (id: string) => void;

  addExam: (e: Omit<Exam, "id">) => void;
  updateExam: (id: string, patch: Partial<Exam>) => void;
  deleteExam: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: "black",
      studyOption: null,
      modules: {},
      tasks: [],
      internships: [],
      internshipEvents: [],
      journalEntries: [],
      exams: [],
      notes: [],
      quizResults: {},
      chapterQuizResults: {},

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "black" ? "white" : "black" })),

      setStudyOption: (option) => set({ studyOption: option }),

      getModuleRuntime: (moduleId) => {
        return get().modules[moduleId] ?? emptyModuleRuntime();
      },

      toggleObjective: (moduleId, objectiveId) =>
        set((state) => {
          const current = state.modules[moduleId] ?? emptyModuleRuntime();
          const done = !current.objectiveStatus[objectiveId];
          return {
            modules: {
              ...state.modules,
              [moduleId]: { ...current, objectiveStatus: { ...current.objectiveStatus, [objectiveId]: done } },
            },
          };
        }),

      setChapterObjectives: (moduleId, objectiveIds, done) =>
        set((state) => {
          const current = state.modules[moduleId] ?? emptyModuleRuntime();
          const nextStatus = { ...current.objectiveStatus };
          for (const id of objectiveIds) nextStatus[id] = done;
          return { modules: { ...state.modules, [moduleId]: { ...current, objectiveStatus: nextStatus } } };
        }),

      setHoursStudied: (moduleId, hours) =>
        set((state) => {
          const current = state.modules[moduleId] ?? emptyModuleRuntime();
          return {
            modules: { ...state.modules, [moduleId]: { ...current, hoursStudied: Math.max(0, hours) } },
          };
        }),

      addHours: (moduleId, delta) =>
        set((state) => {
          const current = state.modules[moduleId] ?? emptyModuleRuntime();
          return {
            modules: {
              ...state.modules,
              [moduleId]: { ...current, hoursStudied: Math.max(0, current.hoursStudied + delta) },
            },
          };
        }),

      setGrades: (moduleId, cc, efm) =>
        set((state) => {
          const current = state.modules[moduleId] ?? emptyModuleRuntime();
          return {
            modules: { ...state.modules, [moduleId]: { ...current, ccGrade: cc, efmGrade: efm } },
          };
        }),

      addNote: (moduleId, text) =>
        set((state) => ({
          notes: [
            { id: uid(), moduleId, text, createdAt: new Date().toISOString() },
            ...state.notes,
          ],
        })),

      deleteNote: (id) => set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

      saveQuizResult: (moduleId, result) =>
        set((state) => ({ quizResults: { ...state.quizResults, [moduleId]: result } })),

      clearQuizResult: (moduleId) =>
        set((state) => {
          const next = { ...state.quizResults };
          delete next[moduleId];
          return { quizResults: next };
        }),

      saveChapterQuizResult: (moduleId, chapterId, result) =>
        set((state) => ({
          chapterQuizResults: { ...state.chapterQuizResults, [quizKey(moduleId, chapterId)]: result },
        })),

      clearChapterQuizResult: (moduleId, chapterId) =>
        set((state) => {
          const next = { ...state.chapterQuizResults };
          delete next[quizKey(moduleId, chapterId)];
          return { chapterQuizResults: next };
        }),

      addTask: (task) =>
        set((state) => ({
          tasks: [
            {
              ...task,
              // A task with no module is stored as null, never as "": an empty module id would not
              // match the "no module" branch of the OCS task list filter and the task would be
              // invisible right after being created.
              moduleId: task.moduleId || null,
              priority: normalizeTaskPriority(task.priority),
              status: task.status ?? "todo",
              id: uid(),
              createdAt: new Date().toISOString(),
              ...(task.status === "completed" ? { completedAt: new Date().toISOString() } : {}),
            },
            ...state.tasks,
          ],
        })),

      updateTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            const next: Task = {
              ...t,
              ...patch,
              moduleId: (patch.moduleId ?? t.moduleId) || null,
              priority: normalizeTaskPriority(patch.priority ?? t.priority),
            };
            if (patch.completedAt !== undefined) return next;
            // The form can change the status too, so keep the completion date in sync.
            if (next.status === "completed") {
              return { ...next, completedAt: t.completedAt ?? new Date().toISOString() };
            }
            if (t.status === "completed") {
              const { completedAt: _completedAt, ...rest } = next;
              return rest;
            }
            return next;
          }),
        })),

      deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

      /** Moving a task to "completed" stamps `completedAt` once; leaving that status clears it. */
      setTaskStatus: (id, status) =>
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            if (status === "completed") {
              return { ...t, status, completedAt: t.completedAt ?? new Date().toISOString() };
            }
            if (t.status === "completed") {
              const { completedAt: _completedAt, ...rest } = t;
              return { ...rest, status };
            }
            return { ...t, status };
          }),
        })),

      moveTask: (id, deadline) =>
        set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, deadline } : t)) })),

      addInternship: (i) => {
        const id = uid();
        set((state) => ({ internships: [...state.internships, { ...i, id }] }));
        return id;
      },

      updateInternship: (id, patch) =>
        set((state) => ({
          internships: state.internships.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),

      deleteInternship: (id) =>
        set((state) => ({
          internships: state.internships.filter((i) => i.id !== id),
          internshipEvents: state.internshipEvents.filter((e) => e.internshipId !== id),
        })),

      addInternshipEvent: (e) =>
        set((state) => ({ internshipEvents: [...state.internshipEvents, { ...e, id: uid() }] })),

      updateInternshipEvent: (id, patch) =>
        set((state) => ({
          internshipEvents: state.internshipEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      deleteInternshipEvent: (id) =>
        set((state) => ({ internshipEvents: state.internshipEvents.filter((e) => e.id !== id) })),

      upsertJournalEntry: (entry) =>
        set((state) => {
          const existingByDate = state.journalEntries.find((j) => j.date === entry.date && j.id !== entry.id);
          const id = entry.id ?? existingByDate?.id ?? uid();
          const now = new Date().toISOString();
          const withoutOld = state.journalEntries.filter((j) => j.id !== id);
          return {
            journalEntries: [
              ...withoutOld,
              {
                id,
                date: entry.date,
                learned: entry.learned,
                workedOn: entry.workedOn,
                completed: entry.completed,
                notUnderstood: entry.notUnderstood,
                problems: entry.problems,
                questions: entry.questions,
                skills: entry.skills,
                notes: entry.notes,
                updatedAt: now,
              },
            ],
          };
        }),

      deleteJournalEntry: (id) =>
        set((state) => ({ journalEntries: state.journalEntries.filter((j) => j.id !== id) })),

      addExam: (e) => set((state) => ({ exams: [...state.exams, { ...e, id: uid() }] })),

      updateExam: (id, patch) =>
        set((state) => ({ exams: state.exams.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

      deleteExam: (id) => set((state) => ({ exams: state.exams.filter((e) => e.id !== id) })),
    }),
    {
      name: "ocs-study-dashboard",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage))),
      version: 6,
      skipHydration: true,
      migrate: (persistedState) => {
        const state = persistedState as
          | {
              modules?: Record<string, any>;
              internships?: any[];
              notes?: Note[];
              tasks?: any[];
              theme?: Theme;
              quizResults?: Record<string, QuizResult>;
              chapterQuizResults?: Record<string, QuizResult>;
            }
          | undefined;
        if (state?.tasks) {
          state.tasks = state.tasks.map((t) => {
            const status: TaskStatus = t.status ?? (t.completed ? "completed" : "todo");
            return {
              ...t,
              // v5: a deadline was mandatory; it is now an optional due date, so a task without
              // one is kept as-is instead of being pinned to today.
              deadline: t.deadline ?? undefined,
              priority: normalizeTaskPriority(t.priority),
              status,
              // v5 had no completion date: stamp it for tasks that were already done.
              completedAt: status === "completed" ? t.completedAt ?? t.createdAt ?? new Date().toISOString() : undefined,
            };
          });
        }
        if (state && !state.theme) {
          state.theme = "black";
        }
        if (state?.modules) {
          const migratedNotes: Note[] = [];
          for (const key of Object.keys(state.modules)) {
            const m = state.modules[key];
            if (!m.objectiveStatus) {
              m.objectiveStatus = {};
              delete m.chapterStatus;
            }
            if (typeof m.notes === "string" && m.notes.trim()) {
              migratedNotes.push({
                id: uid(),
                moduleId: key,
                text: m.notes.trim(),
                createdAt: new Date().toISOString(),
              });
            }
            delete m.notes;
          }
          if (migratedNotes.length) {
            state.notes = [...migratedNotes, ...(state.notes ?? [])];
          }
        }
        if (state?.internships) {
          state.internships = state.internships.map((i) => ({ effGrade: null, ...i }));
        }
        if (state && !state.quizResults) {
          state.quizResults = {};
        }
        if (state && !state.chapterQuizResults) {
          // Module-level results already stored under `quizResults` are intentionally left there
          // so the pre-V1.09-02 scores stay readable; chapter results start empty.
          state.chapterQuizResults = {};
        }
        return state as AppState;
      },
    }
  )
);

export function countCompletedObjectives(runtime: ModuleRuntime | undefined): number {
  if (!runtime) return 0;
  return Object.values(runtime.objectiveStatus).filter(Boolean).length;
}

export function computeModuleProgress(runtime: ModuleRuntime | undefined, totalObjectives: number): number {
  if (!runtime || totalObjectives === 0) return 0;
  return Math.round((countCompletedObjectives(runtime) / totalObjectives) * 100);
}

export function computeModuleHoursProgress(runtime: ModuleRuntime | undefined, totalHours: number): number {
  if (!runtime || totalHours <= 0) return 0;
  return Math.min(100, Math.round((runtime.hoursStudied / totalHours) * 100));
}

export function isModuleHoursCompleted(runtime: ModuleRuntime | undefined, totalHours: number): boolean {
  return totalHours > 0 && (runtime?.hoursStudied ?? 0) >= totalHours;
}

export function deriveChapterStatus(chapter: ChapterDef, runtime: ModuleRuntime | undefined): ChapterStatus {
  if (!runtime || chapter.objectives.length === 0) return "not_started";
  const done = chapter.objectives.filter((o) => runtime.objectiveStatus[o.id]).length;
  if (done === 0) return "not_started";
  if (done === chapter.objectives.length) return "completed";
  return "in_progress";
}

export function countCompletedChapters(chapters: ChapterDef[], runtime: ModuleRuntime | undefined): number {
  return chapters.filter((ch) => deriveChapterStatus(ch, runtime) === "completed").length;
}

export function computeIsModuleStarted(runtime: ModuleRuntime | undefined): boolean {
  if (!runtime) return false;
  if (runtime.hoursStudied > 0) return true;
  if (Object.values(runtime.objectiveStatus).some(Boolean)) return true;
  if (runtime.ccGrade !== null || runtime.efmGrade !== null) return true;
  return false;
}

export { ALL_MODULES };
export const TODAY = todayISO();
