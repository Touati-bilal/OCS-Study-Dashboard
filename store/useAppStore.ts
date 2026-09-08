"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ALL_MODULES, ChapterDef } from "@/lib/modules";
import { uid, todayISO } from "@/lib/utils";
import type {
  ChapterStatus,
  Exam,
  Internship,
  InternshipEvent,
  JournalEntry,
  ModuleRuntime,
  Note,
  StudyOption,
  Task,
} from "@/lib/types";

function emptyModuleRuntime(): ModuleRuntime {
  return { hoursStudied: 0, ccGrade: null, efmGrade: null, objectiveStatus: {} };
}

interface AppState {
  studyOption: StudyOption | null;
  modules: Record<string, ModuleRuntime>;
  tasks: Task[];
  internships: Internship[];
  internshipEvents: InternshipEvent[];
  journalEntries: JournalEntry[];
  exams: Exam[];
  notes: Note[];

  setStudyOption: (option: StudyOption) => void;

  getModuleRuntime: (moduleId: string) => ModuleRuntime;
  toggleObjective: (moduleId: string, objectiveId: string) => void;
  setChapterObjectives: (moduleId: string, objectiveIds: string[], done: boolean) => void;
  setHoursStudied: (moduleId: string, hours: number) => void;
  addHours: (moduleId: string, delta: number) => void;
  setGrades: (moduleId: string, cc: number | null, efm: number | null) => void;

  addNote: (moduleId: string, text: string) => void;
  deleteNote: (id: string) => void;

  addTask: (task: Omit<Task, "id" | "createdAt" | "completed">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;

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
      studyOption: null,
      modules: {},
      tasks: [],
      internships: [],
      internshipEvents: [],
      journalEntries: [],
      exams: [],
      notes: [],

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

      addTask: (task) =>
        set((state) => ({
          tasks: [
            { ...task, id: uid(), completed: false, createdAt: new Date().toISOString() },
            ...state.tasks,
          ],
        })),

      updateTask: (id, patch) =>
        set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

      toggleTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
        })),

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
      version: 3,
      skipHydration: true,
      migrate: (persistedState) => {
        const state = persistedState as
          | { modules?: Record<string, any>; internships?: any[]; notes?: Note[] }
          | undefined;
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
