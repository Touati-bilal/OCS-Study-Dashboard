import { HeroHeader } from "@/components/dashboard/HeroHeader";
import { OverallProgressCard } from "@/components/dashboard/OverallProgressCard";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { ModuleProgressList } from "@/components/dashboard/ModuleProgressList";
import { TodoSection } from "@/components/dashboard/TodoSection";
import { HydrationGate } from "@/components/layout/HydrationGate";

export default function DashboardPage() {
  return (
    <HydrationGate>
      <HeroHeader />
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-3 lg:gap-x-8 lg:px-10 lg:pb-8">
        <div className="min-w-0 lg:col-span-2">
          <OverallProgressCard />
          <ModuleProgressList />
        </div>
        <div className="min-w-0 lg:col-span-1">
          <StatsGrid />
          <TodoSection />
        </div>
      </div>
    </HydrationGate>
  );
}
