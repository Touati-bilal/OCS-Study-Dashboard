export type ChapterStatus = "not_started" | "in_progress" | "completed";

export interface ModuleRuntime {
  hoursStudied: number;
  ccGrade: number | null;
  efmGrade: number | null;
  objectiveStatus: Record<string, boolean>;
  notes: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  moduleId: string | null;
  deadline: string | null;
  completed: boolean;
  createdAt: string;
}

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
