"use client";

import { useCallback, useState } from "react";

import { collectSnapshot } from "@/lib/prv/collect";
import { getLastCompletedWeek, todayIso } from "@/lib/prv/weekly";
import type { ReportSettings } from "@/lib/prv/trajectory";

/**
 * Talks to the PRV API from the browser.
 *
 * Every call goes to a route that re-checks the session server-side, so a 401 here means the
 * session expired and the owner has to unlock again - the hook surfaces that by reloading rather
 * than trying to work around it.
 */
export function usePrv() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T | null> => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(url, { cache: "no-store", ...init });
        if (response.status === 401) {
          // The session is gone: send the owner back to the unlock screen.
          if (typeof window !== "undefined") window.location.assign("/prv/deverrouiller");
          return null;
        }
        const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
        if (!response.ok) {
          setError(payload?.error ?? "La requête a échoué.");
          return null;
        }
        return payload;
      } catch {
        setError("Connexion impossible. Réessayez.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  /** Generates the report for a week from the real store, read here in the browser. */
  const generateReport = useCallback(
    (weekEnd?: string, settings?: ReportSettings) => {
      const anchor = weekEnd ?? todayIso();
      const body: Record<string, unknown> = { snapshot: collectSnapshot(), weekEnd: anchor };
      if (settings) body.settings = settings;
      return request<{ key: string; weekEnd: string; generation: number; empty: boolean }>(
        "/api/prv/reports",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
    },
    [request]
  );

  const listReports = useCallback(
    () => request<{ reports: unknown[]; trend: unknown[] }>("/api/prv/reports"),
    [request]
  );

  const getReport = useCallback(
    (weekEnd: string) => request<Record<string, unknown>>(`/api/prv/reports/${weekEnd}`),
    [request]
  );

  const analyze = useCallback(
    (weekEnd: string) =>
      request<{ status: string; interpretation: string[]; focus: string[] }>(
        `/api/prv/ai/analyze/${weekEnd}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      ),
    [request]
  );

  const proposeTasks = useCallback(
    (note: string) =>
      request<{
        status: string;
        requiresConfirmation: true;
        proposals: Array<{ title: string; description: string; priority: string; moduleId: string | null; rationale: string }>;
        message?: string;
      }>("/api/prv/ai/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: collectSnapshot(), note }),
      }),
    [request]
  );

  const lock = useCallback(async () => {
    await request<{ ok: boolean }>("/api/prv/lock", { method: "POST" });
    if (typeof window !== "undefined") window.location.assign("/prv/deverrouiller");
  }, [request]);

  return { busy, error, request, generateReport, listReports, getReport, analyze, proposeTasks, lock };
}

/** The download URL for a report's PDF. It needs the opaque `downloadId`, never just the week. */
export function pdfUrl(weekEnd: string, downloadId: string): string {
  return `/api/prv/reports/${weekEnd}/pdf?d=${encodeURIComponent(downloadId)}`;
}

export { getLastCompletedWeek };
