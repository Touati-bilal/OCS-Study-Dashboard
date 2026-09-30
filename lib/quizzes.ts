import { isOccOrsModule, type ModuleDef } from "./modules";
import { M201_CHAPTER_QUIZ_QUESTIONS } from "./quizzes/m201";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  source: string;
}

export interface QuizDefinition {
  moduleId: string;
  /** Chapter the quiz belongs to (id from `ModuleDef.chapters`). */
  chapterId: string;
  chapterTitle: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
}

/**
 * Every quiz is attached to a chapter, never to the module itself. The registry is therefore
 * keyed by `moduleId:chapterId` so two chapters of the same module never share a result.
 */
export const QUIZZES: Record<string, QuizDefinition> = {};

export function quizKey(moduleId: string, chapterId: string): string {
  return `${moduleId}:${chapterId}`;
}

function buildDefinition(
  moduleId: string,
  chapterId: string,
  chapterTitle: string,
  title: string,
  description: string,
  questions: QuizQuestion[]
): QuizDefinition {
  const key = quizKey(moduleId, chapterId);
  QUIZZES[key] = { moduleId, chapterId, chapterTitle, title, description, questions };
  return QUIZZES[key];
}

buildDefinition(
  "M201",
  "ch-1",
  "Cybersecurity Terminology",
  "Quiz — Terminologie de la cybersécurité",
  "Vulnérabilités, menaces, attaques courantes et triade CIA : les questions qui portent sur le vocabulaire et la manière de nommer les failles et les risques.",
  M201_CHAPTER_QUIZ_QUESTIONS["ch-1"]
);

buildDefinition(
  "M201",
  "ch-2",
  "Standards and Regulations",
  "Quiz — Standards et réglementations",
  "PSSI,.normes et cadre juridique (loi 09-08, RGPD, CNDP, DGSSI, CNIL) : tout ce qui encadre formellement la sécurité de l'information.",
  M201_CHAPTER_QUIZ_QUESTIONS["ch-2"]
);

buildDefinition(
  "M201",
  "ch-3",
  "Security Principles",
  "Quiz — Principes de sécurité",
  "Défense en profondeur, protection des applications et traitement des risques : comment on applique concrètement les principes de sécurité.",
  M201_CHAPTER_QUIZ_QUESTIONS["ch-3"]
);

/** Returns the chapter quiz of a module, or `undefined` when that chapter has no quiz yet. */
export function getChapterQuiz(moduleId: string, chapterId: string): QuizDefinition | undefined {
  const quiz = QUIZZES[quizKey(moduleId, chapterId)];
  return quiz && quiz.questions.length > 0 ? quiz : undefined;
}

export function hasChapterQuiz(moduleId: string, chapterId: string): boolean {
  return getChapterQuiz(moduleId, chapterId) !== undefined;
}

export function getChapterQuizzesOfModule(moduleId: string): QuizDefinition[] {
  return Object.values(QUIZZES).filter((q) => q.moduleId === moduleId && q.questions.length > 0);
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
