"use client";

import { useHydrated } from "@/hooks/useHydrated";

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand-500" />
      </div>
    );
  }

  return <>{children}</>;
}
