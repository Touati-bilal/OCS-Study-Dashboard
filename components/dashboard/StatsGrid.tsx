"use client";

import { Card } from "@/components/ui/Card";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { useAggregateStats } from "@/hooks/useModuleStats";
import { Clock3, Layers, Target } from "lucide-react";

export function StatsGrid() {
  const stats = useAggregateStats();

  const items = [
    {
      icon: Clock3,
      color: "#48a3ff",
      label: "Heures d'étude",
      value: stats.totalHours,
      suffix: "h",
    },
    {
      icon: Layers,
      color: "#a78bfa",
      label: "Modules au total",
      value: stats.totalCount,
      suffix: "",
    },
    {
      icon: Target,
      color: "#34d399",
      label: "Modules terminés",
      value: stats.completedCount,
      suffix: "",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 px-5 pb-4 md:px-8 lg:px-0">
      {items.map((item, i) => (
        <Card key={item.label} delay={0.1 + i * 0.05} className="flex flex-col items-center gap-1.5 p-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: item.color + "22" }}
          >
            <item.icon size={16} style={{ color: item.color }} />
          </div>
          <p className="font-display text-lg font-bold leading-none">
            <AnimatedCounter value={item.value} suffix={item.suffix} />
          </p>
          <p className="text-center text-[10px] leading-tight text-ink/40">{item.label}</p>
        </Card>
      ))}
    </div>
  );
}
