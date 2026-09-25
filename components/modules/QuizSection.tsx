"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/store/useAppStore";
import { getQuiz, scoreQuiz } from "@/lib/quizzes";
import { CheckCircle2, HelpCircle, ListChecks, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = "intro" | "running" | "done";

export function QuizSection({ moduleId, color }: { moduleId: string; color: string }) {
  const quiz = getQuiz(moduleId);
  const savedResult = useAppStore((s) => s.quizResults[moduleId]);
  const saveQuizResult = useAppStore((s) => s.saveQuizResult);
  const clearQuizResult = useAppStore((s) => s.clearQuizResult);

  const [stage, setStage] = useState<Stage>(savedResult ? "done" : "intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, number> | null>(null);
  const [review, setReview] = useState(false);

  const questions = quiz?.questions ?? [];
  const total = questions.length;
  const current = questions[index];
  const answered = current ? answers[current.id] !== undefined : false;

  if (!quiz || total === 0) {
    return (
      <Card hover={false} className="flex flex-col items-center gap-2 p-8 text-center">
        <HelpCircle size={24} style={{ color }} />
        <p className="font-display text-base font-semibold text-ink/85">Tsenaw Update</p>
        <p className="max-w-sm text-xs leading-relaxed text-ink/45">
          Le quiz de ce module sera disponible dès que les activités correspondantes seront
          publiées.
        </p>
      </Card>
    );
  }

  function start() {
    setIndex(0);
    setAnswers({});
    setSubmittedAnswers(null);
    setReview(false);
    setStage("running");
  }

  function select(optionIndex: number) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: optionIndex }));
  }

  function next() {
    if (!answered) return;
    if (index + 1 >= total) {
      const score = scoreQuiz(questions, answers);
      saveQuizResult(moduleId, { ...score, completedAt: new Date().toISOString() });
      setSubmittedAnswers(answers);
      setStage("done");
      return;
    }
    setIndex((i) => i + 1);
  }

  function restart() {
    clearQuizResult(moduleId);
    setSubmittedAnswers(null);
    setReview(false);
    setStage("intro");
  }

  if (stage === "running" && current) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            Question {index + 1} / {total}
          </p>
          <Badge color={color} variant="outline">
            {Object.keys(answers).length} / {total} répondues
          </Badge>
        </div>
        <ProgressBar
          value={((index + (answered ? 1 : 0)) / total) * 100}
          color={color}
          height={5}
          showShimmer={false}
        />

        <Card delay={0.05} hover={false} className="p-4">
          <p className="text-sm font-medium leading-relaxed text-ink/90">{current.question}</p>
          <div className="mt-3 flex flex-col gap-2">
            {current.options.map((option, optionIndex) => {
              const selected = answers[current.id] === optionIndex;
              return (
                <button
                  key={optionIndex}
                  onClick={() => select(optionIndex)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs transition-colors",
                    selected ? "border-transparent text-ink/90" : "border-ink/10 text-ink/65 hover:bg-ink/[0.04]"
                  )}
                  style={selected ? { backgroundColor: color + "22" } : undefined}
                >
                  <span
                    className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
                    style={{
                      borderColor: selected ? color : "rgba(120,120,140,0.25)",
                      color: selected ? color : undefined,
                    }}
                  >
                    {String.fromCharCode(65 + optionIndex)}
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">{option}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStage("intro")}>
            Quitter
          </Button>
          <Button size="sm" onClick={next} disabled={!answered}>
            {index + 1 >= total ? "Terminer le quiz" : "Suivant"}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "done" && savedResult) {
    const correct = savedResult.correct;
    const incorrect = savedResult.incorrect;
    return (
      <div className="flex flex-col gap-3">
        <Card delay={0.05} hover={false} className="p-5">
          <div className="flex items-center gap-5">
            <ProgressRing
              value={savedResult.percentage}
              color={savedResult.percentage >= 50 ? "#34d399" : "#fbbf24"}
              size={86}
              strokeWidth={8}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink/45">Compréhension du module :</p>
              <p className="font-display text-2xl font-bold">{savedResult.percentage}%</p>
              <p className="mt-0.5 text-xs text-ink/45">
                Score : {correct} / {savedResult.total}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-ink/8 pt-4">
            <div className="flex items-center gap-2 rounded-xl py-1.5">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span className="text-xs text-ink/55">
                {correct} bonne{correct > 1 ? "s" : ""} réponse{correct > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl py-1.5">
              <XCircle size={16} className="text-rose-400" />
              <span className="text-xs text-ink/55">
                {incorrect} mauvaise{incorrect > 1 ? "s" : ""} réponse{incorrect > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-ink/35">
            Résultat enregistré le{" "}
            {new Date(savedResult.completedAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </Card>

        {review && submittedAnswers ? (
          <div className="flex flex-col gap-2">
            {questions.map((question, i) => {
              const isCorrect = submittedAnswers[question.id] === question.correctIndex;
              return (
                <Card key={question.id} delay={0.03 * i} hover={false} className="p-3.5">
                  <div className="flex items-start gap-2.5">
                    {isCorrect ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-snug text-ink/80">
                        {i + 1}. {question.question}
                      </p>
                      {!isCorrect && (
                        <p className="mt-1 text-[11px] leading-snug text-ink/55">
                          Bonne réponse : {question.options[question.correctIndex]}
                        </p>
                      )}
                      <p className="mt-1 truncate text-[10px] text-ink/30" title={question.source}>
                        Source : {question.source}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
            <div>
              <Button variant="secondary" size="sm" onClick={() => setReview(false)}>
                Masquer le corrigé
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {submittedAnswers && (
              <Button size="sm" onClick={() => setReview(true)}>
                <ListChecks size={14} /> Voir le corrigé
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={restart}>
              <RotateCcw size={14} /> Recommencer le quiz
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card delay={0.05} hover={false} className="flex flex-col items-center gap-3 p-6 text-center">
      <ListChecks size={24} style={{ color }} />
      <div>
        <p className="font-display text-base font-semibold text-ink/90">{quiz.title}</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-ink/45">{quiz.description}</p>
      </div>
      <Badge color={color}>{total} questions</Badge>
      <Button onClick={start} className="mt-1">
        Commencer le quiz
      </Button>
    </Card>
  );
}
