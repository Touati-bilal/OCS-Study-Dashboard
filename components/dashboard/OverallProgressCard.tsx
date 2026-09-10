"use client";

import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { useAggregateStats } from "@/hooks/useModuleStats";
import { CheckCircle2, Clock3, CircleDashed } from "lucide-react";

export function OverallProgressCard() {
  const stats = useAggregateStats();

  return (
    <Card delay={0.05} className="mx-5 mb-4 p-5 md:mx-8 lg:mx-0 lg:p-6">
      <div className="flex items-center gap-5">
        <ProgressRing value={stats.overallProgress} size={92} strokeWidth={9} color="#48a3ff" />
        <div className="flex-1">
          <p className="text-xs font-medium text-ink/45">Progression globale</p>
          <p className="font-display text-2xl font-bold">
            <AnimatedCounter value={stats.overallProgress} suffix="%" />
          </p>
          <p className="mt-0.5 text-xs text-ink/40">
            {stats.startedCount} / {stats.totalCount} modules entamés
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-ink/8 pt-4">
        <MiniStat icon={CheckCircle2} color="#34d399" value={stats.completedCount} label="Terminés" />
        <MiniStat icon={Clock3} color="#fbbf24" value={stats.inProgressCount} label="En cours" />
        <MiniStat icon={CircleDashed} color="#94a3b8" value={stats.remainingCount} label="Restants" />
      </div>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: React.ElementType;
  color: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl py-2">
      <Icon size={16} style={{ color }} />
      <span className="font-display text-base font-bold">
        <AnimatedCounter value={value} />
      </span>
      <span className="text-[10px] text-ink/40">{label}</span>
    </div>
  );
}
