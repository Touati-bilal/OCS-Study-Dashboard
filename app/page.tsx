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
      <OverallProgressCard />
      <StatsGrid />
      <ModuleProgressList />
      <TodoSection />
    </HydrationGate>
  );
}
