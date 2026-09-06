"use client";

import { ModuleCard } from "./ModuleCard";
import type { ModuleDef } from "@/lib/modules";
import { useModuleStats } from "@/hooks/useModuleStats";

export function ModuleGrid({ modules }: { modules: ModuleDef[] }) {
  const stats = useModuleStats(modules);

  return (
    <div className="flex flex-col gap-3 px-5 pb-8">
      {stats.map((stat, i) => (
        <ModuleCard key={stat.module.id} stat={stat} delay={i * 0.05} />
      ))}
    </div>
  );
}
