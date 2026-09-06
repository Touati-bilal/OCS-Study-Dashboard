import { PageHeader } from "@/components/layout/PageHeader";
import { ModuleGrid } from "@/components/modules/ModuleGrid";
import { CategorySummary } from "@/components/modules/CategorySummary";
import { HydrationGate } from "@/components/layout/HydrationGate";
import { SECONDARY_MODULES } from "@/lib/modules";

export default function SecondaryModulesPage() {
  return (
    <>
      <PageHeader title="Modules secondaires" subtitle="EGTS — Matières complémentaires" />
      <HydrationGate>
        <div className="pt-4">
          <CategorySummary modules={SECONDARY_MODULES} color="#a78bfa" />
          <ModuleGrid modules={SECONDARY_MODULES} />
        </div>
      </HydrationGate>
    </>
  );
}
