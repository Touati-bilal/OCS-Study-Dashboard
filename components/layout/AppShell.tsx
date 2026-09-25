"use client";

import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { ThemeToggle } from "./ThemeToggle";
import { useHydrated } from "@/hooks/useHydrated";
import { useAppStore } from "@/store/useAppStore";
import { APP_VERSION_LABEL } from "@/lib/app-info";
import { StudyOptionGate } from "@/components/onboarding/StudyOptionGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "black" ? "#000000" : "#ffffff");
  }, [theme, hydrated]);

  if (!hydrated) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-paper md:h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-brand-500" />
      </div>
    );
  }

  return (
    <StudyOptionGate>
      <div className="relative flex h-[100dvh] w-full bg-paper md:h-screen">
        <div className="pointer-events-none fixed inset-0 hidden bg-grid-glow md:block" />

        <Sidebar />

        <div className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 md:hidden">
            <span className="truncate text-[11px] text-ink/25">{APP_VERSION_LABEL}</span>
            <ThemeToggle />
          </div>
          <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </div>
          <BottomNav />
        </div>
      </div>
    </StudyOptionGate>
  );
}
