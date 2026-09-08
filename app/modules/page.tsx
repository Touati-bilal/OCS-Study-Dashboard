"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { ModuleGrid } from "@/components/modules/ModuleGrid";
import { CategorySummary } from "@/components/modules/CategorySummary";
import { HydrationGate } from "@/components/layout/HydrationGate";
import { useAppStore } from "@/store/useAppStore";
import { getMainModules, getMainModulesSubtitle } from "@/lib/modules";

export default function MainModulesPage() {
  const studyOption = useAppStore((s) => s.studyOption);
  const modules = getMainModules(studyOption);

  return (
    <>
      <PageHeader title="Modules principaux" subtitle={getMainModulesSubtitle(studyOption)} />
      <HydrationGate>
        <div className="pt-4">
          <CategorySummary modules={modules} color="#48a3ff" />
          {modules.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-white/40 md:px-8 lg:px-10">
              Aucun module pratique pour cette filière pour le moment.
            </p>
          ) : (
            <ModuleGrid modules={modules} />
          )}
        </div>
      </HydrationGate>
    </>
  );
}
