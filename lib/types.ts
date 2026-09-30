export type ChapterStatus = "not_started" | "in_progress" | "completed";

export type StudyOption = "OCS" | "OCC" | "ORS";

export interface ModuleRuntime {
  hoursStudied: number;
  ccGrade: number | null;
  efmGrade: number | null;
  objectiveStatus: Record<string, boolean>;
}

export interface Note {
  id: string;
  moduleId: string;
  text: string;
  createdAt: string;
}

export interface QuizResult {
  correct: number;
  incorrect: number;
  total: number;
  percentage: number;
  completedAt: string;
}

/**
 * Task priority is a *reason*, not a magnitude: the colour tells why the task matters.
 *   "prof"      red    — the professor explicitly assigned / recommended it
 *   "important" orange — personally important for me
 *   "normal"    green  — a normal task that may be useful in the future
 */
export type TaskPriority = "prof" | "important" | "normal";

export type TaskStatus = "todo" | "in_progress" | "completed";

export interface Task {
  id: string;
  title: string;
  description?: string;
  /** Automatically filled from the module the task is created in — never picked by hand there. */
  moduleId: string | null;
  /** Optional chapter / "partie" of the module, when the task belongs to one. */
  chapterId?: string;
  /** Due date. Optional: a task can be open-ended. */
  deadline?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  /** Set the first time the task reaches the "completed" status, never overwritten afterwards. */
  completedAt?: string;
  notes?: string;
  links?: string[];
  /** Where the task comes from (professor's instruction, activity, article...). */
  source?: string;
}

export type Theme = "black" | "white";

export interface Internship {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  supervisor: string;
  description: string;
  objectives: string;
  effGrade: number | null;
}

export interface InternshipEvent {
  id: string;
  internshipId: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  notes?: string;
  color?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  learned: string;
  workedOn: string;
  completed: string;
  notUnderstood: string;
  problems: string;
  questions: string;
  skills: string;
  notes: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  name: string;
  module: string;
  date: string;
  time: string;
  location: string;
  notes: string;
}
