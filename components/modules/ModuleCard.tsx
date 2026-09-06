"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import type { ModuleStat } from "@/hooks/useModuleStats";
import { Clock3, ChevronRight, BookOpenCheck } from "lucide-react";
import { FINAL_MAX } from "@/lib/grades";

export function ModuleCard({ stat, delay = 0 }: { stat: ModuleStat; delay?: number }) {
  const { module, progress, hoursStudied, finalGrade, completedChapters, totalChapters, started } = stat;

  return (
    <Link href={`/modules/${module.id}`}>
      <Card delay={delay} className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge color={module.color}>{module.code}</Badge>
              {module.efmRegional && (
                <Badge color="#fbbf24" variant="outline" className="text-[10px]">
                  EFM régional
                </Badge>
              )}
              {!started && (
                <Badge color="#64748b" variant="outline" className="text-[10px]">
                  Non commencé
                </Badge>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-white/90">{module.name}</p>
          </div>
          <ChevronRight size={18} className="mt-1 shrink-0 text-white/30" />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={progress} color={module.color} className="flex-1" />
          <span className="text-xs font-semibold text-white/70">{progress}%</span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
          <span className="flex items-center gap-1">
            <Clock3 size={12} /> {hoursStudied}h / {module.duration}h
          </span>
          <span className="flex items-center gap-1">
            <BookOpenCheck size={12} /> {completedChapters}/{totalChapters} chapitres
          </span>
          {finalGrade !== null && (
            <span className="ml-auto font-semibold text-white/70">
              Note: {finalGrade}/{FINAL_MAX}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
