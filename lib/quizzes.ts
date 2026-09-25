import { isOccOrsModule, type ModuleDef } from "./modules";
import { M201_QUIZ } from "./quizzes/m201";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  source: string;
}

export interface QuizDefinition {
  moduleId: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
}

export const QUIZZES: Record<string, QuizDefinition> = {
  M201: M201_QUIZ,
};

export function getQuiz(moduleId: string): QuizDefinition | undefined {
  return QUIZZES[moduleId];
}

export function hasQuiz(moduleId: string): boolean {
  return Boolean(QUIZZES[moduleId]?.questions.length);
}

export function computeQuizPercentage(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export function scoreQuiz(questions: QuizQuestion[], answers: Record<string, number>) {
  const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length;
  return {
    correct,
    incorrect: questions.length - correct,
    total: questions.length,
    percentage: computeQuizPercentage(correct, questions.length),
  };
}

export function isOcsMainModule(module: ModuleDef): boolean {
  return module.category === "main" && !isOccOrsModule(module.id);
}
