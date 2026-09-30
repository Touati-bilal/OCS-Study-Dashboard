"use client";

import { useHydrated } from "@/hooks/useHydrated";

/**
 * Holds back PRV page content until the persisted store has been read.
 *
 * The PRV pages are client components backed by the Zustand store, which rehydrates from
 * `localStorage` before React's first client render but has no such data on the server. Rendering
 * the real content straight away would produce a hydration mismatch, so this shows a spinner for
 * the first paint instead.
 *
 * Crucially it sits *below* the session check in `app/(prv)/prv/(private)/layout.tsx`, which is a
 * server component and therefore always runs first. Deferring markup here delays what the visitor
 * sees; it never affects what the server authorises.
 */
export function PrvHydration({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="flex min-h-[60dvh] w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-brand-500" />
      </div>
    );
  }

  return <>{children}</>;
}
