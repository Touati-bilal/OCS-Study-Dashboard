"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());

  useEffect(() => {
    if (useAppStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    useAppStore.persist.rehydrate();
    return unsub;
  }, []);

  return hydrated;
}
