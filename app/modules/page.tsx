import { PageHeader } from "@/components/layout/PageHeader";
import { ModuleGrid } from "@/components/modules/ModuleGrid";
import { CategorySummary } from "@/components/modules/CategorySummary";
import { HydrationGate } from "@/components/layout/HydrationGate";
import { MAIN_MODULES } from "@/lib/modules";

export default function MainModulesPage() {
  return (
    <>
      <PageHeader title="Modules principaux" subtitle="Cybersécurité — M201 à M206" />
      <HydrationGate>
        <div className="pt-4">
          <CategorySummary modules={MAIN_MODULES} color="#48a3ff" />
          <ModuleGrid modules={MAIN_MODULES} />
        </div>
      </HydrationGate>
    </>
  );
}
