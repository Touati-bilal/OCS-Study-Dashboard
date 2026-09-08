"use client";

import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useHydrated } from "@/hooks/useHydrated";
import { StudyOptionGate } from "@/components/onboarding/StudyOptionGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-base-950 md:h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
      </div>
    );
  }

  return (
    <StudyOptionGate>
      <div className="relative flex h-[100dvh] w-full bg-base-950 md:h-screen">
        <div className="pointer-events-none fixed inset-0 hidden bg-grid-glow md:block" />

        <Sidebar />

        <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </div>
          <BottomNav />
        </div>
      </div>
    </StudyOptionGate>
  );
}
