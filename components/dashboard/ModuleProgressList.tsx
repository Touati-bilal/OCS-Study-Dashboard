"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/store/useAppStore";
import { useModuleStats } from "@/hooks/useModuleStats";
import { ChevronRight, Clock3, Sparkles } from "lucide-react";
import { FINAL_MAX } from "@/lib/grades";

export function ModuleProgressList() {
  const stats = useModuleStats();
  const studyOption = useAppStore((s) => s.studyOption);
  const isOcs = studyOption === "OCS";
  const started = stats.filter((s) => s.started);
  const inProgress = isOcs ? started.filter((s) => !s.completed) : started;
  const completed = isOcs ? started.filter((s) => s.completed) : [];

  return (
    <div className="px-5 pb-4 md:px-8 lg:px-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-ink/85">Modules en cours</h2>
        <Link href="/modules" className="text-xs font-medium text-brand-400">
          Voir tout
        </Link>
      </div>

      {inProgress.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-6 text-center">
          <Sparkles size={22} className="text-ink/30" />
          <p className="text-sm text-ink/50">
            {completed.length > 0 ? "Aucun module en cours, bravo !" : "Aucun module entamé pour l'instant."}
          </p>
          {completed.length === 0 && (
            <Link href="/modules" className="text-xs font-medium text-brand-400">
              Commencer un module →
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {inProgress.map((s, i) => (
            <Link key={s.module.id} href={`/modules/${s.module.id}`}>
              <Card delay={0.05 * i} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge color={s.module.color}>{s.module.code}</Badge>
                      {s.module.category === "secondary" && (
                        <Badge color="#94a3b8" variant="outline">
                          EGTS
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-sm font-medium text-ink/90">{s.module.name}</p>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-ink/30" />
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar value={s.progress} color={s.module.color} className="flex-1" />
                  <span className="text-xs font-semibold text-ink/70">{s.progress}%</span>
                </div>

                <div className="mt-2.5 flex items-center gap-4 text-[11px] text-ink/45">
                  <span className="flex items-center gap-1">
                    <Clock3 size={12} /> {s.hoursStudied}h étudiées
                  </span>
                  <span>
                    {s.completedChapters}/{s.totalChapters} chapitres
                  </span>
                  {s.finalGrade !== null && (
                    <span className="ml-auto font-semibold text-ink/70">
                      {s.finalGrade}/{FINAL_MAX}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
