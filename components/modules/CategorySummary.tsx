"use client";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { useAggregateStats } from "@/hooks/useModuleStats";
import type { ModuleDef } from "@/lib/modules";
import { Clock3 } from "lucide-react";

export function CategorySummary({ modules, color }: { modules: ModuleDef[]; color: string }) {
  const stats = useAggregateStats(modules);

  return (
    <Card delay={0} className="mx-5 mb-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/45">Progression moyenne</p>
          <p className="font-display text-xl font-bold">
            <AnimatedCounter value={stats.overallProgress} suffix="%" />
          </p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-xs text-white/45">
            <Clock3 size={12} /> Heures totales
          </p>
          <p className="font-display text-xl font-bold">
            <AnimatedCounter value={stats.totalHours} suffix="h" />
          </p>
        </div>
      </div>
      <ProgressBar value={stats.overallProgress} color={color} className="mt-3" />
      <div className="mt-2 flex justify-between text-[11px] text-white/40">
        <span>{stats.completedCount} terminés</span>
        <span>{stats.inProgressCount} en cours</span>
        <span>{stats.remainingCount} restants</span>
      </div>
    </Card>
  );
}
